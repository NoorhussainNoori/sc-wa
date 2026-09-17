import csv
import io
import json
import os
import tempfile
from decimal import Decimal
import jdatetime
from django.core.management import call_command
from django.db import transaction
from django.db.models import Sum, Q
from django.http import HttpResponse
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .backup_fixture import build_dumpdata_backup_json, repair_backup_fixture_shamsi_dates
from .payment_allocation import is_allocatable_fee_type, replay_after_payment_change
from .models import (
    Student,
    Teacher,
    TeacherSalaryPayment,
    SchoolClass,
    FeeType,
    Payment,
    ExpenseCategory,
    Expense,
)
from .signals import suppress_default_fee_types
from .serializers import (
    StudentSerializer,
    TeacherSerializer,
    TeacherSalaryPaymentSerializer,
    SchoolClassSerializer,
    FeeTypeSerializer,
    PaymentSerializer,
    ExpenseCategorySerializer,
    ExpenseSerializer,
)


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all().order_by("-id")
    serializer_class = StudentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params.get("q")
        include_inactive = self.request.query_params.get("include_inactive")
        is_active = self.request.query_params.get("is_active")

        if include_inactive not in {"1", "true", "True"}:
            if is_active in {"1", "true", "True"}:
                qs = qs.filter(is_active=True)
            elif is_active in {"0", "false", "False"}:
                qs = qs.filter(is_active=False)
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(registration_number__icontains=q)
                | Q(father_name__icontains=q)
                | Q(grandfather_name__icontains=q)
                | Q(phone__icontains=q)
            )

        for field in ["name", "registration_number", "father_name", "grandfather_name", "phone"]:
            value = self.request.query_params.get(field)
            if value:
                lookup = {f"{field}__icontains": value}
                qs = qs.filter(**lookup)
        return qs

    @action(detail=True, methods=["get"])
    def payments(self, request, pk=None):
        student = self.get_object()
        payments = student.payments.all().order_by("-created_at")
        serializer = PaymentSerializer(payments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def report(self, request, pk=None):
        student = self.get_object()
        payments = student.payments.all()
        totals = (
            payments.values("fee_type__name")
            .annotate(total=Sum("amount"))
            .order_by("fee_type__name")
        )
        total_paid = payments.aggregate(total=Sum("amount")).get("total") or Decimal("0")
        return Response(
            {
                "student_id": student.id,
                "total_paid": total_paid,
                "totals_by_fee_type": list(totals),
            }
        )

    @action(detail=False, methods=["post"], url_path="import")
    def import_students(self, request):
        upload = request.FILES.get("file")
        mode = (request.data.get("mode") or "partial").strip().lower()
        if not upload:
            return Response({"detail": "File is required."}, status=status.HTTP_400_BAD_REQUEST)
        if mode not in {"partial", "strict"}:
            return Response({"detail": "mode must be 'partial' or 'strict'."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rows = _read_student_rows(upload)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if not rows:
            return Response({"detail": "No data rows found in file."}, status=status.HTTP_400_BAD_REQUEST)

        classes_by_id = {str(c.id): c for c in SchoolClass.objects.all()}
        classes_by_name_year = {
            (c.name.strip().lower(), c.year_shamsi.strip()): c for c in SchoolClass.objects.all()
        }

        errors = []
        students_to_create = []
        existing_registration_numbers = {
            value
            for value in Student.objects.exclude(registration_number="").values_list("registration_number", flat=True)
        }
        pending_registration_numbers = set()
        max_rows = 10000
        if len(rows) > max_rows:
            return Response(
                {"detail": f"Too many rows ({len(rows)}). Max allowed is {max_rows}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for row_number, row in rows:
            student_obj, row_errors = _build_student_from_row(row, row_number, classes_by_id, classes_by_name_year)
            if row_errors:
                errors.extend(row_errors)
                continue
            reg_no = (student_obj.registration_number or "").strip()
            if reg_no in existing_registration_numbers or reg_no in pending_registration_numbers:
                errors.append(
                    {
                        "row": row_number,
                        "field": "registration_number",
                        "message": "Registration number already exists.",
                    }
                )
                continue
            pending_registration_numbers.add(reg_no)
            students_to_create.append(student_obj)

        if mode == "strict" and errors:
            return Response(
                {
                    "total_rows": len(rows),
                    "imported": 0,
                    "failed": len(errors),
                    "errors": errors[:200],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            Student.objects.bulk_create(students_to_create, batch_size=500)

        return Response(
            {
                "total_rows": len(rows),
                "imported": len(students_to_create),
                "failed": len(errors),
                "errors": errors[:200],
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="import-template")
    def import_template(self, request):
        headers = [
            "class_id",
            "class_name",
            "year_shamsi",
            "name",
            "registration_number",
            "father_name",
            "grandfather_name",
            "phone",
            "monthly_fee_override",
            "transport_fee_override",
            "uniform_fee_override",
            "book_fee_override",
            "previous_balance",
        ]
        sample = "1,,1404,Ali,REG-001,Reza,Hassan,700000001,1200,0,0,0,3500"
        content = ",".join(headers) + "\n" + sample + "\n"
        response = HttpResponse(content, content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="students_import_template.csv"'
        return response


class TeacherViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.all().order_by("-id")
    serializer_class = TeacherSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(father_name__icontains=q)
                | Q(phone__icontains=q)
                | Q(email__icontains=q)
                | Q(department__icontains=q)
            )
        return qs


class TeacherSalaryPaymentViewSet(viewsets.ModelViewSet):
    queryset = TeacherSalaryPayment.objects.select_related("teacher").all().order_by("-date_shamsi", "-id")
    serializer_class = TeacherSalaryPaymentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        teacher_id = self.request.query_params.get("teacher_id")
        month = self.request.query_params.get("month")
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")

        if teacher_id:
            qs = qs.filter(teacher_id=teacher_id)
        if month:
            qs = qs.filter(month_shamsi=month)
        if start and end:
            try:
                start_date = _parse_shamsi_date(start)
                end_date = _parse_shamsi_date(end)
            except ValueError:
                return qs.none()
            qs = qs.filter(date_shamsi__gte=start_date, date_shamsi__lte=end_date)
        return qs


class SchoolClassViewSet(viewsets.ModelViewSet):
    queryset = SchoolClass.objects.all().order_by("-year_shamsi", "name")
    serializer_class = SchoolClassSerializer


class FeeTypeViewSet(viewsets.ModelViewSet):
    queryset = FeeType.objects.all().order_by("name")
    serializer_class = FeeTypeSerializer


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("student", "fee_type").all().order_by("-created_at")
    serializer_class = PaymentSerializer

    def perform_destroy(self, instance):
        student = instance.student
        fee_type = instance.fee_type
        super().perform_destroy(instance)
        if student and is_allocatable_fee_type(fee_type):
            replay_after_payment_change(student, fee_type)

    def get_queryset(self):
        qs = super().get_queryset()
        student_id = self.request.query_params.get("student_id")
        fee_type_id = self.request.query_params.get("fee_type_id")
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        month = self.request.query_params.get("month")

        if student_id:
            qs = qs.filter(student_id=student_id)
        if fee_type_id:
            qs = qs.filter(fee_type_id=fee_type_id)
        if month:
            qs = qs.filter(month_shamsi=month)
        if start and end:
            try:
                start_date = _parse_shamsi_date(start)
                end_date = _parse_shamsi_date(end)
            except ValueError:
                return qs.none()
            qs = qs.filter(date_shamsi__gte=start_date, date_shamsi__lte=end_date)
        return qs


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all().order_by("name")
    serializer_class = ExpenseCategorySerializer


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related("category").all().order_by("-created_at")
    serializer_class = ExpenseSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        category_id = self.request.query_params.get("category_id")
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        month = self.request.query_params.get("month")

        if category_id:
            qs = qs.filter(category_id=category_id)
        if month:
            try:
                year, month_num = _parse_shamsi_month(month)
            except ValueError:
                return qs.none()
            qs = qs.filter(date_shamsi__year=year, date_shamsi__month=month_num)
        if start and end:
            try:
                start_date = _parse_shamsi_date(start)
                end_date = _parse_shamsi_date(end)
            except ValueError:
                return qs.none()
            qs = qs.filter(date_shamsi__gte=start_date, date_shamsi__lte=end_date)
        return qs


class ReportSummaryView(APIView):
    def get(self, request):
        period = request.query_params.get("period")  # day, month, year, custom
        date = request.query_params.get("date")  # YYYY-MM-DD or YYYY-MM or YYYY
        start = request.query_params.get("start")
        end = request.query_params.get("end")
        include_items = request.query_params.get("include_items") == "1"

        payment_qs = Payment.objects.select_related("student", "fee_type", "school_class").all()
        expense_qs = Expense.objects.select_related("category").all()
        salary_qs = TeacherSalaryPayment.objects.select_related("teacher").all()

        if period in {"day", "month", "year"} and date:
            try:
                start_date, end_date = _shamsi_period_bounds(period, date)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            payment_qs = payment_qs.filter(date_shamsi__gte=start_date, date_shamsi__lte=end_date)
            expense_qs = expense_qs.filter(date_shamsi__gte=start_date, date_shamsi__lte=end_date)
            salary_qs = salary_qs.filter(date_shamsi__gte=start_date, date_shamsi__lte=end_date)
        elif period == "custom" and start and end:
            try:
                start_date = _parse_shamsi_date(start)
                end_date = _parse_shamsi_date(end)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            payment_qs = payment_qs.filter(date_shamsi__gte=start_date, date_shamsi__lte=end_date)
            expense_qs = expense_qs.filter(date_shamsi__gte=start_date, date_shamsi__lte=end_date)
            salary_qs = salary_qs.filter(date_shamsi__gte=start_date, date_shamsi__lte=end_date)

        total_revenue = payment_qs.aggregate(total=Sum("amount")).get("total") or Decimal("0")
        expense_records_total = expense_qs.aggregate(total=Sum("amount")).get("total") or Decimal("0")
        teacher_salaries_total = salary_qs.aggregate(total=Sum("amount")).get("total") or Decimal("0")
        total_expenses = expense_records_total + teacher_salaries_total
        profit = total_revenue - total_expenses

        response = {
            "total_revenue": total_revenue,
            "total_expenses": total_expenses,
            "expense_records_total": expense_records_total,
            "teacher_salaries_total": teacher_salaries_total,
            "profit": profit,
        }

        if include_items:
            response["payments"] = PaymentSerializer(payment_qs.order_by("-created_at"), many=True).data
            response["expenses"] = ExpenseSerializer(expense_qs.order_by("-created_at"), many=True).data
            response["teacher_salary_payments"] = TeacherSalaryPaymentSerializer(
                salary_qs.order_by("-created_at"), many=True
            ).data

        return Response(response)


class MonthlyDueFeesView(APIView):
    """
    Returns students who still owe monthly and/or transport fees through a given Shamsi month.

    For each fee type, dues are cumulative from month 01 (Hamal) of that Shamsi year through
    the requested month.

    The breakdown is:
    - *_fee_previous: sum of shortfalls for all months *before* the requested month
    - *_fee_current: shortfall for the requested month itself
    - *_fee: previous + current (backwards‑compatible total)
    - *_previous_months_count: how many of those previous months still have a balance (>0),
      for the bill "برج" column on باقیات rows (number of months, not the month name).
    """

    def get(self, request):
        month_shamsi = request.query_params.get("month_shamsi")
        if not month_shamsi:
            year = request.query_params.get("year")
            month = request.query_params.get("month")
            if year and month:
                try:
                    month_shamsi = f"{int(year):04d}-{int(month):02d}"
                except ValueError as exc:
                    return Response(
                        {"detail": "Invalid year/month format."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        if not month_shamsi:
            return Response(
                {"detail": "month_shamsi is required (YYYY-MM)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            year_int, end_month_int = _parse_shamsi_month(month_shamsi)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        months_in_range = [f"{year_int}-{m:02d}" for m in range(1, end_month_int + 1)]
        target_month = month_shamsi
        dues_from_month_shamsi = f"{year_int:04d}-01"

        class_id = request.query_params.get("class_id")

        monthly_fee_types = FeeType.objects.filter(name__icontains="monthly")
        if not monthly_fee_types.exists():
            return Response(
                {"detail": "Monthly FeeType not found. Create a FeeType with 'monthly' in its name."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        transport_fee_types = FeeType.objects.filter(name__icontains="transport")
        previous_balance_fee_types = _previous_balance_fee_types()

        students_qs = Student.objects.select_related("school_class").filter(school_class__isnull=False)
        if class_id:
            students_qs = students_qs.filter(school_class_id=class_id)

        student_ids = list(students_qs.values_list("id", flat=True))

        monthly_paid_by_student_month = {}
        if student_ids:
            for row in (
                Payment.objects.filter(
                    student_id__in=student_ids,
                    month_shamsi__in=months_in_range,
                    fee_type__in=monthly_fee_types,
                )
                .values("student_id", "month_shamsi")
                .annotate(paid=Sum("amount"))
            ):
                monthly_paid_by_student_month[(row["student_id"], row["month_shamsi"])] = row["paid"]

        transport_paid_by_student_month = {}
        if student_ids:
            for row in (
                Payment.objects.filter(
                    student_id__in=student_ids,
                    month_shamsi__in=months_in_range,
                    fee_type__in=transport_fee_types,
                )
                .values("student_id", "month_shamsi")
                .annotate(paid=Sum("amount"))
            ):
                transport_paid_by_student_month[(row["student_id"], row["month_shamsi"])] = row["paid"]

        previous_balance_paid_by_student = {}
        if student_ids and previous_balance_fee_types.exists():
            for row in (
                Payment.objects.filter(
                    student_id__in=student_ids,
                    month_shamsi__in=months_in_range,
                    fee_type__in=previous_balance_fee_types,
                )
                .values("student_id")
                .annotate(paid=Sum("amount"))
            ):
                previous_balance_paid_by_student[row["student_id"]] = row["paid"] or Decimal("0")

        results = []
        for student in students_qs:
            start_month_shamsi = max(_student_enrolled_month_shamsi(student), dues_from_month_shamsi)
            end_month_shamsi = _student_reporting_end_month_shamsi(student, target_month)
            if start_month_shamsi > end_month_shamsi:
                student_months_in_range = []
            else:
                student_months_in_range = _iter_shamsi_months(start_month_shamsi, end_month_shamsi)

            expected_monthly = (
                student.monthly_fee_override
                if student.monthly_fee_override is not None
                else student.school_class.monthly_fee
            )
            expected_transport = (
                student.transport_fee_override
                if student.transport_fee_override is not None
                else student.school_class.transport_fee
            )

            # Totals across the whole Hamal→target period
            paid_monthly_total = Decimal("0")
            paid_transport_total = Decimal("0")

            # Split dues into "previous months" vs "current month"
            due_monthly_previous = Decimal("0")
            due_monthly_current = Decimal("0")
            due_transport_previous = Decimal("0")
            due_transport_current = Decimal("0")
            monthly_previous_unpaid_months = 0
            transport_previous_unpaid_months = 0

            sid = student.id
            for m in student_months_in_range:
                paid_m = monthly_paid_by_student_month.get((sid, m)) or Decimal("0")
                paid_monthly_total += paid_m
                short_m = max(expected_monthly - paid_m, Decimal("0"))
                if m == target_month:
                    due_monthly_current += short_m
                else:
                    due_monthly_previous += short_m
                    if short_m > 0:
                        monthly_previous_unpaid_months += 1

                paid_t = transport_paid_by_student_month.get((sid, m)) or Decimal("0")
                paid_transport_total += paid_t
                short_t = max(expected_transport - paid_t, Decimal("0"))
                if m == target_month:
                    due_transport_current += short_t
                else:
                    due_transport_previous += short_t
                    if short_t > 0:
                        transport_previous_unpaid_months += 1

            due_monthly_total = due_monthly_previous + due_monthly_current
            due_transport_total = due_transport_previous + due_transport_current
            previous_balance_paid = previous_balance_paid_by_student.get(student.id) or Decimal("0")
            previous_balance_due = max(student.previous_balance - previous_balance_paid, Decimal("0"))
            total_due = due_monthly_total + due_transport_total + previous_balance_due

            if total_due > 0:
                results.append(
                    {
                        "student_id": student.id,
                        "student_name": student.name,
                        "registration_number": student.registration_number,
                        "father_name": student.father_name,
                        "grandfather_name": student.grandfather_name,
                        "phone": student.phone,
                        "class_id": student.school_class_id,
                        "class_name": student.school_class.name,
                        "class_year_shamsi": student.school_class.year_shamsi,
                        "expected_monthly_fee": str(expected_monthly),
                        "paid_monthly_fee": str(paid_monthly_total),
                        # Monthly fee dues (previous vs current vs total)
                        "due_monthly_fee_previous": str(due_monthly_previous),
                        "due_monthly_fee_current": str(due_monthly_current),
                        "due_monthly_previous_months_count": monthly_previous_unpaid_months,
                        "due_monthly_fee": str(due_monthly_total),
                        "expected_transport_fee": str(expected_transport),
                        "paid_transport_fee": str(paid_transport_total),
                        # Transport dues (previous vs current vs total)
                        "due_transport_fee_previous": str(due_transport_previous),
                        "due_transport_fee_current": str(due_transport_current),
                        "due_transport_previous_months_count": transport_previous_unpaid_months,
                        "due_transport_fee": str(due_transport_total),
                        "previous_balance": _money_str(student.previous_balance),
                        "paid_previous_balance": _money_str(previous_balance_paid),
                        "due_previous_balance": _money_str(previous_balance_due),
                        "due_amount": str(total_due),
                    }
                )

        return Response(
            {
                "month_shamsi": month_shamsi,
                "dues_from_month_shamsi": dues_from_month_shamsi,
                "months_count": len(months_in_range),
                "total_due_students": len(results),
                "results": results,
            }
        )


class ClassMonthlyFeesReportView(APIView):
    """
    Per-class totals for one Shamsi month: monthly + transport for that month,
    plus one-time uniform expected/paid (payments through the selected month).
    """

    def get(self, request):
        month_shamsi = request.query_params.get("month_shamsi")
        if not month_shamsi:
            year = request.query_params.get("year")
            month = request.query_params.get("month")
            if year and month:
                try:
                    month_shamsi = f"{int(year):04d}-{int(month):02d}"
                except ValueError:
                    return Response(
                        {"detail": "Invalid year/month format."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        if not month_shamsi:
            return Response(
                {"detail": "month_shamsi is required (YYYY-MM)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            _parse_shamsi_month(month_shamsi)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        monthly_fee_types = FeeType.objects.filter(name__icontains="monthly")
        if not monthly_fee_types.exists():
            return Response(
                {"detail": "Monthly FeeType not found. Create a FeeType with 'monthly' in its name."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        transport_fee_types = FeeType.objects.filter(name__icontains="transport")
        uniform_fee_types = FeeType.objects.filter(name__icontains="uniform")

        def empty_row(cls):
            return {
                "class_id": cls.id,
                "class_name": cls.name,
                "year_shamsi": cls.year_shamsi,
                "class_label": f"{cls.name} ({cls.year_shamsi})",
                "student_count": 0,
                "total_monthly_expected": "0",
                "total_monthly_paid": "0",
                "total_uniform_expected": "0",
                "total_uniform_paid": "0",
                "total_transport_expected": "0",
                "total_transport_paid": "0",
                "total_expected": "0",
                "total_paid": "0",
                "free_students_count": 0,
            }

        rows = []
        for cls in SchoolClass.objects.all().order_by("year_shamsi", "name"):
            students = [
                s for s in Student.objects.filter(school_class=cls)
                if _student_is_billable_for_month(s, month_shamsi)
            ]
            n = len(students)
            if n == 0:
                rows.append(empty_row(cls))
                continue

            sids = [s.id for s in students]
            monthly_paid_map = {
                row["student_id"]: row["paid"]
                for row in Payment.objects.filter(
                    student_id__in=sids,
                    month_shamsi=month_shamsi,
                    fee_type__in=monthly_fee_types,
                )
                .values("student_id")
                .annotate(paid=Sum("amount"))
            }
            transport_paid_map = {
                row["student_id"]: row["paid"]
                for row in Payment.objects.filter(
                    student_id__in=sids,
                    month_shamsi=month_shamsi,
                    fee_type__in=transport_fee_types,
                )
                .values("student_id")
                .annotate(paid=Sum("amount"))
            }
            uniform_paid_map = {}
            if uniform_fee_types.exists():
                uniform_paid_map = {
                    row["student_id"]: row["paid"]
                    for row in Payment.objects.filter(
                        student_id__in=sids,
                        fee_type__in=uniform_fee_types,
                        month_shamsi__lte=month_shamsi,
                    )
                    .values("student_id")
                    .annotate(paid=Sum("amount"))
                }

            total_m_exp = Decimal("0")
            total_u_exp = Decimal("0")
            total_t_exp = Decimal("0")
            total_m_paid = Decimal("0")
            total_u_paid = Decimal("0")
            total_t_paid = Decimal("0")
            free_students = 0

            for s in students:
                exp_m = (
                    s.monthly_fee_override if s.monthly_fee_override is not None else cls.monthly_fee
                )
                exp_u = (
                    s.uniform_fee_override if s.uniform_fee_override is not None else cls.uniform_fee
                )
                exp_t = (
                    s.transport_fee_override if s.transport_fee_override is not None else cls.transport_fee
                )
                paid_m = monthly_paid_map.get(s.id) or Decimal("0")
                paid_u = uniform_paid_map.get(s.id) or Decimal("0")
                paid_t = transport_paid_map.get(s.id) or Decimal("0")
                total_m_exp += exp_m
                total_u_exp += exp_u
                total_t_exp += exp_t
                total_m_paid += paid_m
                total_u_paid += paid_u
                total_t_paid += paid_t
                if exp_m == 0 and exp_t == 0:
                    free_students += 1

            total_exp = total_m_exp + total_u_exp + total_t_exp
            total_paid = total_m_paid + total_u_paid + total_t_paid
            rows.append(
                {
                    "class_id": cls.id,
                    "class_name": cls.name,
                    "year_shamsi": cls.year_shamsi,
                    "class_label": f"{cls.name} ({cls.year_shamsi})",
                    "student_count": n,
                    "total_monthly_expected": str(total_m_exp),
                    "total_monthly_paid": str(total_m_paid),
                    "total_uniform_expected": str(total_u_exp),
                    "total_uniform_paid": str(total_u_paid),
                    "total_transport_expected": str(total_t_exp),
                    "total_transport_paid": str(total_t_paid),
                    "total_expected": str(total_exp),
                    "total_paid": str(total_paid),
                    "free_students_count": free_students,
                }
            )

        return Response({"month_shamsi": month_shamsi, "classes": rows})


class TeacherStatementReportView(APIView):
    """
    Printable per-teacher salary statement.
    """

    def get(self, request):
        teacher_id = request.query_params.get("teacher_id")
        if not teacher_id:
            return Response({"detail": "teacher_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        requested_month_shamsi = request.query_params.get("month_shamsi") or _current_shamsi_month()
        try:
            month_shamsi = _cap_teacher_salary_month(requested_month_shamsi)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            teacher = Teacher.objects.get(pk=teacher_id)
        except Teacher.DoesNotExist:
            return Response({"detail": "Teacher not found."}, status=status.HTTP_404_NOT_FOUND)

        start_month_shamsi = _teacher_started_month_shamsi(teacher)
        start_year, start_month = _parse_shamsi_month(start_month_shamsi)
        end_year, end_month = _parse_shamsi_month(month_shamsi)
        if (start_year, start_month) > (end_year, end_month):
            months_in_scope = []
        else:
            try:
                months_in_scope = _iter_shamsi_months(start_month_shamsi, month_shamsi)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payment_qs = TeacherSalaryPayment.objects.filter(
            teacher_id=teacher.id,
            month_shamsi__in=months_in_scope,
        ).order_by("date_shamsi", "id")
        payments = list(payment_qs)

        paid_by_month = {
            row["month_shamsi"]: row["paid"]
            for row in payment_qs.values("month_shamsi").annotate(paid=Sum("amount")).order_by("month_shamsi")
        }

        month_rows = []
        total_should_pay = Decimal("0")
        total_paid = Decimal("0")
        total_balance = Decimal("0")
        for month in months_in_scope:
            expected = teacher.salary
            paid = paid_by_month.get(month) or Decimal("0")
            due = max(expected - paid, Decimal("0"))
            month_rows.append(
                {
                    "month_shamsi": month,
                    "expected_salary": _money_str(expected),
                    "paid_salary": _money_str(paid),
                    "due_salary": _money_str(due),
                }
            )
            total_should_pay += expected
            total_paid += paid
            total_balance += due

        return Response(
            {
                "teacher": {
                    "id": teacher.id,
                    "name": teacher.name,
                    "father_name": teacher.father_name,
                    "phone": teacher.phone,
                    "email": teacher.email,
                    "address": teacher.address,
                    "department": teacher.department,
                    "salary": _money_str(teacher.salary),
                    "created_date_shamsi": _teacher_created_date_shamsi(teacher),
                    "start_month_shamsi": start_month_shamsi,
                },
                "through_month_shamsi": month_shamsi,
                "requested_month_shamsi": requested_month_shamsi,
                "months_count": len(months_in_scope),
                "months": month_rows,
                "salary_payments": TeacherSalaryPaymentSerializer(payments, many=True).data,
                "summary": {
                    "total_expected": _money_str(total_should_pay),
                    "total_paid": _money_str(total_paid),
                    "total_balance": _money_str(total_balance),
                    "total_due": _money_str(total_balance),
                },
            }
        )


SHAMSI_MONTH_LABELS_DARI = (
    "حمل",
    "ثور",
    "جوزا",
    "سرطان",
    "اسد",
    "سنبله",
    "میزان",
    "عقرب",
    "قوس",
    "جدی",
    "دلو",
    "حوت",
)


class TeacherSalaryListReportView(APIView):
    """
    Excel-style staff salary matrix for one Shamsi year:
    شماره | اسم | ولد | وظیفه | each month salary | مجموعه معاش
    """

    def get(self, request):
        year_param = (request.query_params.get("year_shamsi") or "").strip()
        if year_param:
            if not year_param.isdigit() or len(year_param) != 4:
                return Response(
                    {"detail": "year_shamsi must be a 4-digit Shamsi year (e.g. 1404)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            year = int(year_param)
        else:
            year = jdatetime.date.today().year

        month_keys = [f"{year:04d}-{month:02d}" for month in range(1, 13)]
        teachers = list(Teacher.objects.all().order_by("id"))
        payments = (
            TeacherSalaryPayment.objects.filter(month_shamsi__startswith=f"{year:04d}-")
            .values("teacher_id", "month_shamsi")
            .annotate(paid=Sum("amount"))
        )
        paid_map: dict[tuple[int, str], Decimal] = {
            (row["teacher_id"], row["month_shamsi"]): row["paid"] or Decimal("0") for row in payments
        }

        rows = []
        grand_salary_total = Decimal("0")
        month_salary_totals = {key: Decimal("0") for key in month_keys}

        for index, teacher in enumerate(teachers, start=1):
            months = []
            salary_total = Decimal("0")
            months_paid_count = 0
            for month_num, month_key in enumerate(month_keys, start=1):
                paid = paid_map.get((teacher.id, month_key), Decimal("0"))
                has_payment = paid > 0
                if has_payment:
                    months_paid_count += 1
                    salary_total += paid
                    month_salary_totals[month_key] += paid
                months.append(
                    {
                        "month_num": month_num,
                        "month_shamsi": month_key,
                        "label": SHAMSI_MONTH_LABELS_DARI[month_num - 1],
                        "paid": _money_str(paid) if has_payment else None,
                        "paid_display": _money_str(paid) if has_payment else "//",
                        "has_payment": has_payment,
                    }
                )

            grand_salary_total += salary_total
            rows.append(
                {
                    "row_number": index,
                    "teacher_id": teacher.id,
                    "name": teacher.name,
                    "father_name": teacher.father_name,
                    "department": teacher.department,
                    "base_salary": _money_str(teacher.salary),
                    "months": months,
                    "months_paid_count": months_paid_count,
                    "total_salary": _money_str(salary_total),
                }
            )

        return Response(
            {
                "year_shamsi": f"{year:04d}",
                "month_labels": [
                    {"month_num": i + 1, "label": label, "month_shamsi": month_keys[i]}
                    for i, label in enumerate(SHAMSI_MONTH_LABELS_DARI)
                ],
                "rows": rows,
                "summary": {
                    "teachers_count": len(rows),
                    "total_salary": _money_str(grand_salary_total),
                    "month_totals": [
                        {
                            "month_shamsi": key,
                            "label": SHAMSI_MONTH_LABELS_DARI[i],
                            "salary": _money_str(month_salary_totals[key]),
                        }
                        for i, key in enumerate(month_keys)
                    ],
                },
            }
        )


STUDENT_PAYMENT_CATEGORY_META = (
    ("monthly", "فیس ماهوار", "monthly"),
    ("transport", "ترانسپورت", "transport"),
    ("uniform", "یونیفورم", "uniform"),
    ("book", "کتاب", "book"),
)


def _parse_student_payment_categories(raw: str | None) -> list[tuple[str, str, str]]:
    allowed = {item[0]: item for item in STUDENT_PAYMENT_CATEGORY_META}
    if not raw or not str(raw).strip():
        return list(STUDENT_PAYMENT_CATEGORY_META)
    selected = []
    for token in str(raw).split(","):
        key = token.strip().lower()
        if key in allowed and allowed[key] not in selected:
            selected.append(allowed[key])
    return selected or list(STUDENT_PAYMENT_CATEGORY_META)


class StudentPaymentListReportView(APIView):
    """
    Excel-style student payment matrix for one Shamsi year.

    Columns: student info + each month with selected fee categories
    (monthly / transport / uniform / book), student subtotal, then grand total.
    """

    def get(self, request):
        year_param = (request.query_params.get("year_shamsi") or "").strip()
        if year_param:
            if not year_param.isdigit() or len(year_param) != 4:
                return Response(
                    {"detail": "year_shamsi must be a 4-digit Shamsi year (e.g. 1404)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            year = int(year_param)
        else:
            year = jdatetime.date.today().year

        categories = _parse_student_payment_categories(request.query_params.get("categories"))
        category_keys = [item[0] for item in categories]
        class_id = (request.query_params.get("class_id") or "").strip()

        month_keys = [f"{year:04d}-{month:02d}" for month in range(1, 13)]
        students = Student.objects.select_related("school_class").all().order_by(
            "school_class__name", "name", "id"
        )
        if class_id:
            students = students.filter(school_class_id=class_id)

        fee_type_ids_by_category: dict[str, list[int]] = {}
        for key, _label, needle in categories:
            ids = list(FeeType.objects.filter(name__icontains=needle).values_list("id", flat=True))
            fee_type_ids_by_category[key] = ids

        all_fee_type_ids = [fee_id for ids in fee_type_ids_by_category.values() for fee_id in ids]
        paid_map: dict[tuple[int, str, str], Decimal] = {}
        if all_fee_type_ids:
            payment_rows = (
                Payment.objects.filter(
                    fee_type_id__in=all_fee_type_ids,
                    month_shamsi__startswith=f"{year:04d}-",
                )
                .values("student_id", "month_shamsi", "fee_type_id")
                .annotate(paid=Sum("amount"))
            )
            fee_id_to_category = {}
            for key, ids in fee_type_ids_by_category.items():
                for fee_id in ids:
                    fee_id_to_category[fee_id] = key
            for row in payment_rows:
                category_key = fee_id_to_category.get(row["fee_type_id"])
                if not category_key:
                    continue
                map_key = (row["student_id"], row["month_shamsi"], category_key)
                paid_map[map_key] = paid_map.get(map_key, Decimal("0")) + (row["paid"] or Decimal("0"))

        rows = []
        grand_category_totals = {key: Decimal("0") for key in category_keys}
        grand_total = Decimal("0")
        month_category_totals = {
            month_key: {key: Decimal("0") for key in category_keys} for month_key in month_keys
        }

        for index, student in enumerate(students, start=1):
            months = []
            category_totals = {key: Decimal("0") for key in category_keys}
            student_subtotal = Decimal("0")

            for month_num, month_key in enumerate(month_keys, start=1):
                amounts = {}
                displays = {}
                month_total = Decimal("0")
                for key in category_keys:
                    paid = paid_map.get((student.id, month_key, key), Decimal("0"))
                    has_payment = paid > 0
                    amounts[key] = _money_str(paid) if has_payment else None
                    displays[key] = _money_str(paid) if has_payment else "//"
                    if has_payment:
                        month_total += paid
                        category_totals[key] += paid
                        month_category_totals[month_key][key] += paid
                student_subtotal += month_total
                months.append(
                    {
                        "month_num": month_num,
                        "month_shamsi": month_key,
                        "label": SHAMSI_MONTH_LABELS_DARI[month_num - 1],
                        "amounts": amounts,
                        "displays": displays,
                        "month_total": _money_str(month_total) if month_total > 0 else "//",
                    }
                )

            for key in category_keys:
                grand_category_totals[key] += category_totals[key]
            grand_total += student_subtotal

            rows.append(
                {
                    "row_number": index,
                    "student_id": student.id,
                    "name": student.name,
                    "registration_number": student.registration_number,
                    "father_name": student.father_name,
                    "class_name": student.school_class.name if student.school_class_id else "",
                    "class_year_shamsi": student.school_class.year_shamsi if student.school_class_id else "",
                    "is_active": student.is_active,
                    "months": months,
                    "category_totals": {key: _money_str(category_totals[key]) for key in category_keys},
                    "subtotal": _money_str(student_subtotal),
                }
            )

        return Response(
            {
                "year_shamsi": f"{year:04d}",
                "categories": [{"key": key, "label": label} for key, label, _needle in categories],
                "month_labels": [
                    {"month_num": i + 1, "label": label, "month_shamsi": month_keys[i]}
                    for i, label in enumerate(SHAMSI_MONTH_LABELS_DARI)
                ],
                "filters": {
                    "class_id": class_id,
                    "categories": category_keys,
                },
                "rows": rows,
                "summary": {
                    "students_count": len(rows),
                    "category_totals": {key: _money_str(grand_category_totals[key]) for key in category_keys},
                    "grand_total": _money_str(grand_total),
                    "month_totals": [
                        {
                            "month_shamsi": month_key,
                            "label": SHAMSI_MONTH_LABELS_DARI[i],
                            "amounts": {
                                key: _money_str(month_category_totals[month_key][key]) for key in category_keys
                            },
                            "month_total": _money_str(
                                sum(month_category_totals[month_key].values(), Decimal("0"))
                            ),
                        }
                        for i, month_key in enumerate(month_keys)
                    ],
                },
            }
        )


def _join_unique_parts(values, separator="/") -> str:
    seen = set()
    parts = []
    for value in values:
        text = str(value or "").strip()
        if not text:
            continue
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        parts.append(text)
    return separator.join(parts)


def _build_expense_statement_items(expenses: list[Expense]) -> list[dict]:
    """
    Group expenses that share the same description into Excel-style rows.
    Bill numbers are combined with "/" when multiple expenses merge into one row.
    Empty descriptions stay as separate rows (not merged).
    """
    groups: dict[str, dict] = {}
    order: list[str] = []

    for expense in expenses:
        description = (expense.description or "").strip()
        if description:
            key = f"desc:{description.casefold()}"
            item_name = description
        else:
            key = f"id:{expense.id}"
            item_name = ""

        if key not in groups:
            groups[key] = {
                "item_name": item_name,
                "quantity": "",
                "amount": Decimal("0"),
                "bill_numbers": [],
                "notes": [],
                "expense_ids": [],
                "expenses_count": 0,
            }
            order.append(key)

        group = groups[key]
        group["amount"] += expense.amount or Decimal("0")
        group["expenses_count"] += 1
        group["expense_ids"].append(expense.id)
        if not group["quantity"] and (expense.quantity or "").strip():
            group["quantity"] = (expense.quantity or "").strip()
        if (expense.bill_number or "").strip():
            group["bill_numbers"].append(expense.bill_number)
        if (expense.notes or "").strip():
            group["notes"].append(expense.notes)

    items = []
    for index, key in enumerate(order, start=1):
        group = groups[key]
        items.append(
            {
                "row_number": index,
                "item_name": group["item_name"],
                "quantity": group["quantity"],
                "amount": _money_str(group["amount"]),
                "bill_number": _join_unique_parts(group["bill_numbers"], "/"),
                "notes": _join_unique_parts(group["notes"], " | "),
                "expenses_count": group["expenses_count"],
                "expense_ids": group["expense_ids"],
            }
        )
    return items


class ExpenseCategoryStatementReportView(APIView):
    """
    Printable expense statement with optional date range.

    - No category_id: all categories (one section each)
    - With category_id: that category only
    """

    def get(self, request):
        category_id = (request.query_params.get("category_id") or "").strip()
        start = request.query_params.get("start")
        end = request.query_params.get("end")
        month_shamsi = request.query_params.get("month_shamsi")

        expense_qs = Expense.objects.select_related("category").all().order_by(
            "category__name", "date_shamsi", "id"
        )

        selected_category = None
        if category_id:
            try:
                selected_category = ExpenseCategory.objects.get(pk=category_id)
            except ExpenseCategory.DoesNotExist:
                return Response({"detail": "Expense category not found."}, status=status.HTTP_404_NOT_FOUND)
            expense_qs = expense_qs.filter(category_id=selected_category.id)

        if start and end:
            try:
                start_date = _parse_shamsi_date(start)
                end_date = _parse_shamsi_date(end)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            expense_qs = expense_qs.filter(date_shamsi__gte=start_date, date_shamsi__lte=end_date)
        elif month_shamsi:
            try:
                year, month = _parse_shamsi_month(month_shamsi)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            expense_qs = expense_qs.filter(date_shamsi__year=year, date_shamsi__month=month)

        expenses = list(expense_qs)
        sections = []
        grand_total = Decimal("0")
        grand_expense_count = 0
        grand_item_count = 0

        if selected_category:
            category_order = [selected_category]
        else:
            # Keep categories that have expenses in range; preserve name order.
            seen_ids = []
            for expense in expenses:
                if expense.category_id not in seen_ids:
                    seen_ids.append(expense.category_id)
            category_map = {
                cat.id: cat
                for cat in ExpenseCategory.objects.filter(id__in=seen_ids).order_by("name")
            }
            category_order = [category_map[cid] for cid in seen_ids if cid in category_map]

        for category in category_order:
            category_expenses = [expense for expense in expenses if expense.category_id == category.id]
            items = _build_expense_statement_items(category_expenses)
            section_total = sum((expense.amount or Decimal("0") for expense in category_expenses), Decimal("0"))
            grand_total += section_total
            grand_expense_count += len(category_expenses)
            grand_item_count += len(items)
            sections.append(
                {
                    "category": {"id": category.id, "name": category.name},
                    "summary": {
                        "total_amount": _money_str(section_total),
                        "expenses_count": len(category_expenses),
                        "items_count": len(items),
                    },
                    "items": items,
                    "expenses": ExpenseSerializer(category_expenses, many=True).data,
                }
            )

        # Back-compat flat fields when a single category is selected (or only one section).
        flat_items = sections[0]["items"] if len(sections) == 1 else [item for section in sections for item in section["items"]]
        flat_expenses = (
            sections[0]["expenses"] if len(sections) == 1 else [row for section in sections for row in section["expenses"]]
        )

        return Response(
            {
                "category": (
                    {"id": selected_category.id, "name": selected_category.name}
                    if selected_category
                    else None
                ),
                "filters": {
                    "start": start or "",
                    "end": end or "",
                    "month_shamsi": month_shamsi or "",
                    "category_id": category_id,
                    "all_categories": not bool(category_id),
                },
                "summary": {
                    "total_amount": _money_str(grand_total),
                    "expenses_count": grand_expense_count,
                    "items_count": grand_item_count,
                    "categories_count": len(sections),
                },
                "sections": sections,
                "items": flat_items,
                "expenses": flat_expenses,
            }
        )


class StudentStatementReportView(APIView):
    """
    Printable per-student statement with recurring fees, one-time items, and all payments.
    """

    def get(self, request):
        student_id = request.query_params.get("student_id")
        if not student_id:
            return Response(
                {"detail": "student_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        month_shamsi = request.query_params.get("month_shamsi") or _current_shamsi_month()
        try:
            _parse_shamsi_month(month_shamsi)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            student = Student.objects.select_related("school_class").get(pk=student_id)
        except Student.DoesNotExist:
            return Response({"detail": "Student not found."}, status=status.HTTP_404_NOT_FOUND)

        if student.school_class is None:
            return Response(
                {"detail": "Student is not assigned to a class."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        enrolled_month_shamsi = _student_enrolled_month_shamsi(student)
        start_month_shamsi = max(
            enrolled_month_shamsi,
            f"{student.school_class.year_shamsi}-01",
        )
        end_month_shamsi = _student_reporting_end_month_shamsi(student, month_shamsi)
        try:
            if start_month_shamsi > end_month_shamsi:
                months_in_scope = []
            else:
                months_in_scope = _iter_shamsi_months(start_month_shamsi, end_month_shamsi)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        monthly_fee_types = FeeType.objects.filter(name__icontains="monthly")
        transport_fee_types = FeeType.objects.filter(name__icontains="transport")
        uniform_fee_types = FeeType.objects.filter(name__icontains="uniform")
        book_fee_types = FeeType.objects.filter(name__icontains="book")
        previous_balance_fee_types = _previous_balance_fee_types()

        payment_qs = Payment.objects.select_related("student", "fee_type", "school_class").filter(
            student_id=student.id,
            month_shamsi__in=months_in_scope,
        )
        payments = list(payment_qs.order_by("date_shamsi", "id"))
        payment_serializer = PaymentSerializer(payments, many=True)

        monthly_paid_map = _payment_totals_by_month(payment_qs, monthly_fee_types)
        transport_paid_map = _payment_totals_by_month(payment_qs, transport_fee_types)

        recurring_monthly_fee = _student_fee_value(student.monthly_fee_override, student.school_class.monthly_fee)
        recurring_transport_fee = _student_fee_value(student.transport_fee_override, student.school_class.transport_fee)
        one_time_uniform_fee = _student_fee_value(student.uniform_fee_override, student.school_class.uniform_fee)
        one_time_book_fee = _student_fee_value(student.book_fee_override, student.school_class.book_fee)

        month_rows = []
        total_monthly_expected = Decimal("0")
        total_monthly_paid = Decimal("0")
        total_monthly_due = Decimal("0")
        total_transport_expected = Decimal("0")
        total_transport_paid = Decimal("0")
        total_transport_due = Decimal("0")

        for month in months_in_scope:
            paid_monthly = monthly_paid_map.get(month) or Decimal("0")
            paid_transport = transport_paid_map.get(month) or Decimal("0")
            due_monthly = max(recurring_monthly_fee - paid_monthly, Decimal("0"))
            due_transport = max(recurring_transport_fee - paid_transport, Decimal("0"))
            month_rows.append(
                {
                    "month_shamsi": month,
                    "expected_monthly_fee": _money_str(recurring_monthly_fee),
                    "paid_monthly_fee": _money_str(paid_monthly),
                    "due_monthly_fee": _money_str(due_monthly),
                    "expected_transport_fee": _money_str(recurring_transport_fee),
                    "paid_transport_fee": _money_str(paid_transport),
                    "due_transport_fee": _money_str(due_transport),
                    "total_due": _money_str(due_monthly + due_transport),
                }
            )
            total_monthly_expected += recurring_monthly_fee
            total_monthly_paid += paid_monthly
            total_monthly_due += due_monthly
            total_transport_expected += recurring_transport_fee
            total_transport_paid += paid_transport
            total_transport_due += due_transport

        fee_totals = [
            {
                "fee_type_name": row["fee_type__name"],
                "total_paid": _money_str(row["paid"]),
            }
            for row in (
                payment_qs.values("fee_type__name")
                .annotate(paid=Sum("amount"))
                .order_by("fee_type__name")
            )
        ]

        uniform_paid_total = _payment_total_for_types(payment_qs, uniform_fee_types)
        book_paid_total = _payment_total_for_types(payment_qs, book_fee_types)
        previous_balance_paid_total = _payment_total_for_types(payment_qs, previous_balance_fee_types)
        other_paid_total = sum(
            Decimal(str(row["paid"] or Decimal("0")))
            for row in fee_totals
            if not _is_statement_fee_type_name(row["fee_type_name"])
        )

        uniform_due = max(one_time_uniform_fee - uniform_paid_total, Decimal("0"))
        book_due = max(one_time_book_fee - book_paid_total, Decimal("0"))
        previous_balance_due = max(student.previous_balance - previous_balance_paid_total, Decimal("0"))
        recurring_due = total_monthly_due + total_transport_due
        one_time_due = uniform_due + book_due + previous_balance_due
        total_paid = (
            total_monthly_paid
            + total_transport_paid
            + uniform_paid_total
            + book_paid_total
            + previous_balance_paid_total
            + other_paid_total
        )
        total_expected = (
            total_monthly_expected
            + total_transport_expected
            + one_time_uniform_fee
            + one_time_book_fee
            + student.previous_balance
        )
        total_balance = total_expected - total_paid

        return Response(
            {
                "student": {
                    "id": student.id,
                    "name": student.name,
                    "registration_number": student.registration_number,
                    "father_name": student.father_name,
                    "grandfather_name": student.grandfather_name,
                    "phone": student.phone,
                    "class_id": student.school_class_id,
                    "class_name": student.school_class.name,
                    "class_year_shamsi": student.school_class.year_shamsi,
                    "enrolled_date_shamsi": _student_enrolled_date_shamsi(student),
                    "enrolled_month_shamsi": enrolled_month_shamsi,
                    "previous_balance": _money_str(student.previous_balance),
                },
                "through_month_shamsi": month_shamsi,
                "start_month_shamsi": start_month_shamsi,
                "months_count": len(months_in_scope),
                "months": month_rows,
                "payments": payment_serializer.data,
                "fee_totals": fee_totals,
                "summary": {
                    "total_expected": _money_str(total_expected),
                    "monthly_expected": _money_str(total_monthly_expected),
                    "monthly_paid": _money_str(total_monthly_paid),
                    "monthly_due": _money_str(total_monthly_due),
                    "transport_expected": _money_str(total_transport_expected),
                    "transport_paid": _money_str(total_transport_paid),
                    "transport_due": _money_str(total_transport_due),
                    "uniform_expected": _money_str(one_time_uniform_fee),
                    "uniform_paid": _money_str(uniform_paid_total),
                    "uniform_due": _money_str(uniform_due),
                    "book_expected": _money_str(one_time_book_fee),
                    "book_paid": _money_str(book_paid_total),
                    "book_due": _money_str(book_due),
                    "previous_balance_expected": _money_str(student.previous_balance),
                    "previous_balance_paid": _money_str(previous_balance_paid_total),
                    "previous_balance_due": _money_str(previous_balance_due),
                    "other_paid": _money_str(other_paid_total),
                    "recurring_due": _money_str(recurring_due),
                    "one_time_due": _money_str(one_time_due),
                    "total_paid": _money_str(total_paid),
                    "total_due": _money_str(total_balance),
                    "total_balance": _money_str(total_balance),
                },
            }
        )


_BACKUP_MAX_UPLOAD_BYTES = 50 * 1024 * 1024


class BackupExportView(APIView):
    """
    Download full school data as JSON (users, API tokens, core app).
    Same format as `python manage.py export_backup <file>`.
    """

    def get(self, request):
        raw = build_dumpdata_backup_json().encode("utf-8")
        filename = f"school_rasool_backup_{timezone.now().strftime('%Y%m%d_%H%M%S')}.json"
        response = HttpResponse(raw, content_type="application/json; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class BackupRestoreView(APIView):
    """
    Upload a backup JSON file. Clears the database, then loads the fixture.
    Requires multipart field `confirm` = RESTORE and `file` = backup .json
    """

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if request.data.get("confirm") != "RESTORE":
            return Response(
                {
                    "detail": "Restore refused. Send form field confirm=RESTORE (exact text) together with the file.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        upload = request.FILES.get("file")
        if not upload:
            return Response({"detail": "Missing file field."}, status=status.HTTP_400_BAD_REQUEST)

        body = upload.read()
        if len(body) > _BACKUP_MAX_UPLOAD_BYTES:
            return Response({"detail": "Backup file is too large."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            decoded = body.decode("utf-8")
            parsed = json.loads(decoded)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            return Response(
                {"detail": f"File is not valid UTF-8 JSON: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(parsed, list) or (parsed and not isinstance(parsed[0], dict)):
            return Response(
                {"detail": "Invalid backup format (expected a JSON array)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if parsed and "model" not in parsed[0]:
            return Response(
                {"detail": "Invalid backup format (missing model keys)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        repair_backup_fixture_shamsi_dates(parsed)
        fixed_body = json.dumps(parsed, indent=2, ensure_ascii=False).encode("utf-8")

        fd, path = tempfile.mkstemp(suffix=".json")
        try:
            with os.fdopen(fd, "wb") as tmp:
                tmp.write(fixed_body)
            try:
                # Suppress post_migrate FeeType seeding so flush does not leave
                # rows that conflict with backup PKs during loaddata.
                with suppress_default_fee_types():
                    call_command("flush", interactive=False)
            except Exception as exc:  # noqa: BLE001
                return Response(
                    {"detail": f"Could not clear database: {exc}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            try:
                call_command("loaddata", path)
            except Exception as exc:  # noqa: BLE001
                return Response(
                    {
                        "detail": (
                            "Restore failed after the database was cleared. "
                            f"Re-import this or another backup file. Error: {exc}"
                        ),
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass

        return Response({"detail": "Backup restored successfully. Log in again if your session was reset."})


def _parse_shamsi_date(value: str) -> jdatetime.date:
    try:
        year, month, day = [int(part) for part in value.split("-")]
    except ValueError as exc:
        raise ValueError("Invalid date format. Use YYYY-MM-DD.") from exc
    return jdatetime.date(year, month, day)


def _parse_shamsi_month(value: str) -> tuple[int, int]:
    try:
        year, month = [int(part) for part in value.split("-")]
    except ValueError as exc:
        raise ValueError("Invalid month format. Use YYYY-MM.") from exc
    return year, month


def _parse_shamsi_year(value: str) -> int:
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError("Invalid year format. Use YYYY.") from exc


def _shamsi_month_end(year: int, month: int) -> jdatetime.date:
    if month == 12:
        next_month_start = jdatetime.date(year + 1, 1, 1)
    else:
        next_month_start = jdatetime.date(year, month + 1, 1)
    return next_month_start - jdatetime.timedelta(days=1)


def _shamsi_period_bounds(period: str, date_value: str) -> tuple[jdatetime.date, jdatetime.date]:
    """
    Inclusive Shamsi start/end dates for day/month/year filters.

    django-jalali date_shamsi__year / __month lookups operate on Gregorian storage
    and return wrong results, so callers should filter with __gte/__lte instead.
    """
    if period == "day":
        target = _parse_shamsi_date(date_value)
        return target, target
    if period == "month":
        year, month_num = _parse_shamsi_month(date_value)
        return jdatetime.date(year, month_num, 1), _shamsi_month_end(year, month_num)
    if period == "year":
        year = _parse_shamsi_year(date_value)
        return jdatetime.date(year, 1, 1), _shamsi_month_end(year, 12)
    raise ValueError("Unsupported period.")


def _current_shamsi_month() -> str:
    today = jdatetime.date.today()
    return f"{today.year:04d}-{today.month:02d}"


def _teacher_started_month_shamsi(teacher: Teacher) -> str:
    created = jdatetime.datetime.fromgregorian(datetime=timezone.localtime(teacher.created_at))
    return f"{created.year:04d}-{created.month:02d}"


def _teacher_created_date_shamsi(teacher: Teacher) -> str:
    created = jdatetime.datetime.fromgregorian(datetime=timezone.localtime(teacher.created_at))
    return f"{created.year:04d}-{created.month:02d}-{created.day:02d}"


def _cap_teacher_salary_month(month_shamsi: str) -> str:
    year, month = _parse_shamsi_month(month_shamsi)
    if month > 9:
        month = 9
    return f"{year:04d}-{month:02d}"


def _student_enrolled_date_shamsi(student: Student) -> str:
    enrolled = jdatetime.datetime.fromgregorian(datetime=timezone.localtime(student.created_at))
    return f"{enrolled.year:04d}-{enrolled.month:02d}-{enrolled.day:02d}"


def _student_enrolled_month_shamsi(student: Student) -> str:
    enrolled = jdatetime.datetime.fromgregorian(datetime=timezone.localtime(student.created_at))
    return f"{enrolled.year:04d}-{enrolled.month:02d}"


def _student_deactivated_month_shamsi(student: Student) -> str | None:
    if not student.deactivated_at:
        return None
    deactivated = jdatetime.datetime.fromgregorian(datetime=timezone.localtime(student.deactivated_at))
    return f"{deactivated.year:04d}-{deactivated.month:02d}"


def _previous_shamsi_month(month_shamsi: str) -> str:
    year, month = _parse_shamsi_month(month_shamsi)
    month -= 1
    if month < 1:
        year -= 1
        month = 12
    return f"{year:04d}-{month:02d}"


def _student_reporting_end_month_shamsi(student: Student, requested_month_shamsi: str) -> str:
    end_month_shamsi = requested_month_shamsi
    deactivated_month_shamsi = _student_deactivated_month_shamsi(student)
    if not student.is_active and deactivated_month_shamsi:
        cutoff_month_shamsi = _previous_shamsi_month(deactivated_month_shamsi)
        if cutoff_month_shamsi < end_month_shamsi:
            end_month_shamsi = cutoff_month_shamsi
    return end_month_shamsi


def _student_is_billable_for_month(student: Student, month_shamsi: str) -> bool:
    start_month_shamsi = _student_enrolled_month_shamsi(student)
    end_month_shamsi = _student_reporting_end_month_shamsi(student, month_shamsi)
    return start_month_shamsi <= month_shamsi <= end_month_shamsi


def _iter_shamsi_months(start_month: str, end_month: str) -> list[str]:
    start_year, start_num = _parse_shamsi_month(start_month)
    end_year, end_num = _parse_shamsi_month(end_month)
    if (start_year, start_num) > (end_year, end_num):
        raise ValueError("Start month cannot be after the end month.")

    months = []
    year, month = start_year, start_num
    while (year, month) <= (end_year, end_num):
        months.append(f"{year:04d}-{month:02d}")
        month += 1
        if month > 12:
            year += 1
            month = 1
    return months


def _student_fee_value(override, class_value):
    return override if override is not None else class_value


def _money_str(value) -> str:
    amount = Decimal("0") if value in (None, "") else Decimal(str(value))
    return str(amount.quantize(Decimal("0.00")))


def _payment_totals_by_month(payment_qs, fee_types):
    rows = {}
    if not fee_types.exists():
        return rows
    for row in (
        payment_qs.filter(fee_type__in=fee_types)
        .values("month_shamsi")
        .annotate(paid=Sum("amount"))
        .order_by("month_shamsi")
    ):
        rows[row["month_shamsi"]] = row["paid"] or Decimal("0")
    return rows


def _payment_total_for_types(payment_qs, fee_types):
    if not fee_types.exists():
        return Decimal("0")
    total = payment_qs.filter(fee_type__in=fee_types).aggregate(paid=Sum("amount")).get("paid")
    return total or Decimal("0")


def _is_statement_fee_type_name(name: str) -> bool:
    lowered = (name or "").lower()
    return any(key in lowered for key in ("monthly", "transport", "uniform", "book", "previous balance"))


def _previous_balance_fee_types():
    return FeeType.objects.filter(name__iexact="Previous Balance")


def _normalize_headers(headers):
    return [str(h or "").strip().lower() for h in headers]


def _read_student_rows(upload):
    name = (upload.name or "").lower()
    if name.endswith(".csv"):
        text = upload.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise ValueError("CSV file is missing header row.")
        normalized = _normalize_headers(reader.fieldnames)
        rows = []
        for idx, row in enumerate(reader, start=2):
            mapped = {normalized[i]: (v.strip() if isinstance(v, str) else v) for i, v in enumerate(row.values())}
            rows.append((idx, mapped))
        return rows

    if name.endswith(".xlsx"):
        wb = load_workbook(upload, read_only=True, data_only=True)
        ws = wb.active
        iterator = ws.iter_rows(values_only=True)
        try:
            raw_headers = next(iterator)
        except StopIteration as exc:
            raise ValueError("Excel file is empty.") from exc
        headers = _normalize_headers(raw_headers)
        if not any(headers):
            raise ValueError("Excel file is missing header row.")
        rows = []
        for idx, values in enumerate(iterator, start=2):
            mapped = {}
            for i, key in enumerate(headers):
                if not key:
                    continue
                value = values[i] if i < len(values) else ""
                mapped[key] = value.strip() if isinstance(value, str) else value
            rows.append((idx, mapped))
        return rows

    raise ValueError("Unsupported file format. Use .csv or .xlsx.")


def _parse_optional_decimal(value, field_name, row_number, errors):
    if value in (None, ""):
        return None
    try:
        parsed = Decimal(str(value))
    except Exception:  # noqa: BLE001
        errors.append({"row": row_number, "field": field_name, "message": "Must be a number."})
        return None
    if parsed < 0:
        errors.append({"row": row_number, "field": field_name, "message": "Must be >= 0."})
        return None
    return parsed


def _build_student_from_row(row, row_number, classes_by_id, classes_by_name_year):
    errors = []
    required_fields = ["name", "registration_number", "father_name", "grandfather_name", "phone"]
    for field in required_fields:
        if not str(row.get(field, "")).strip():
            errors.append({"row": row_number, "field": field, "message": "This field is required."})

    phone = str(row.get("phone", "")).strip()
    if phone and not phone.isdigit():
        errors.append({"row": row_number, "field": "phone", "message": "Only digits are allowed."})

    school_class = None
    class_id = str(row.get("class_id", "") or "").strip()
    class_name = str(row.get("class_name", "") or "").strip()
    year_shamsi = str(row.get("year_shamsi", "") or "").strip()

    if class_id:
        school_class = classes_by_id.get(class_id)
        if not school_class:
            errors.append({"row": row_number, "field": "class_id", "message": "Class not found."})
    elif class_name and year_shamsi:
        school_class = classes_by_name_year.get((class_name.lower(), year_shamsi))
        if not school_class:
            errors.append(
                {
                    "row": row_number,
                    "field": "class_name",
                    "message": "Class not found for given class_name + year_shamsi.",
                }
            )
    elif class_name or year_shamsi:
        errors.append(
            {
                "row": row_number,
                "field": "class_name/year_shamsi",
                "message": "Provide both class_name and year_shamsi together.",
            }
        )

    monthly_fee_override = _parse_optional_decimal(
        row.get("monthly_fee_override"), "monthly_fee_override", row_number, errors
    )
    transport_fee_override = _parse_optional_decimal(
        row.get("transport_fee_override"), "transport_fee_override", row_number, errors
    )
    uniform_fee_override = _parse_optional_decimal(
        row.get("uniform_fee_override"), "uniform_fee_override", row_number, errors
    )
    book_fee_override = _parse_optional_decimal(
        row.get("book_fee_override"), "book_fee_override", row_number, errors
    )
    previous_balance = _parse_optional_decimal(
        row.get("previous_balance"), "previous_balance", row_number, errors
    )

    if errors:
        return None, errors

    student = Student(
        school_class=school_class,
        name=str(row.get("name", "")).strip(),
        registration_number=str(row.get("registration_number", "")).strip(),
        father_name=str(row.get("father_name", "")).strip(),
        grandfather_name=str(row.get("grandfather_name", "")).strip(),
        phone=phone,
        monthly_fee_override=monthly_fee_override,
        transport_fee_override=transport_fee_override,
        uniform_fee_override=uniform_fee_override,
        book_fee_override=book_fee_override,
        previous_balance=previous_balance or Decimal("0"),
    )
    return student, []
