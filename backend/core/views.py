import csv
import io
from decimal import Decimal

import jdatetime
from django.db import transaction
from django.db.models import Sum, Q
from django.http import HttpResponse
from openpyxl import load_workbook
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Student,
    Teacher,
    SchoolClass,
    FeeType,
    Payment,
    ExpenseCategory,
    Expense,
)
from .serializers import (
    StudentSerializer,
    TeacherSerializer,
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
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(father_name__icontains=q)
                | Q(grandfather_name__icontains=q)
                | Q(phone__icontains=q)
            )

        for field in ["name", "father_name", "grandfather_name", "phone"]:
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
            "father_name",
            "grandfather_name",
            "phone",
            "monthly_fee_override",
            "transport_fee_override",
            "uniform_fee_override",
            "book_fee_override",
        ]
        sample = "1,,1404,Ali,Reza,Hassan,700000001,1200,0,0,0"
        content = ",".join(headers) + "\n" + sample + "\n"
        response = HttpResponse(content, content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="students_import_template.csv"'
        return response


class TeacherViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.all().order_by("-id")
    serializer_class = TeacherSerializer


class SchoolClassViewSet(viewsets.ModelViewSet):
    queryset = SchoolClass.objects.all().order_by("-year_shamsi", "name")
    serializer_class = SchoolClassSerializer


class FeeTypeViewSet(viewsets.ModelViewSet):
    queryset = FeeType.objects.all().order_by("name")
    serializer_class = FeeTypeSerializer


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("student", "fee_type").all().order_by("-created_at")
    serializer_class = PaymentSerializer

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

        if period in {"day", "month", "year"} and date:
            try:
                if period == "day":
                    target_date = _parse_shamsi_date(date)
                    payment_qs = payment_qs.filter(date_shamsi=target_date)
                    expense_qs = expense_qs.filter(date_shamsi=target_date)
                elif period == "month":
                    year, month_num = _parse_shamsi_month(date)
                    payment_qs = payment_qs.filter(date_shamsi__year=year, date_shamsi__month=month_num)
                    expense_qs = expense_qs.filter(date_shamsi__year=year, date_shamsi__month=month_num)
                elif period == "year":
                    year = _parse_shamsi_year(date)
                    payment_qs = payment_qs.filter(date_shamsi__year=year)
                    expense_qs = expense_qs.filter(date_shamsi__year=year)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        elif period == "custom" and start and end:
            try:
                start_date = _parse_shamsi_date(start)
                end_date = _parse_shamsi_date(end)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            payment_qs = payment_qs.filter(date_shamsi__gte=start_date, date_shamsi__lte=end_date)
            expense_qs = expense_qs.filter(date_shamsi__gte=start_date, date_shamsi__lte=end_date)

        total_revenue = payment_qs.aggregate(total=Sum("amount")).get("total") or Decimal("0")
        total_expenses = expense_qs.aggregate(total=Sum("amount")).get("total") or Decimal("0")
        profit = total_revenue - total_expenses

        response = {
            "total_revenue": total_revenue,
            "total_expenses": total_expenses,
            "profit": profit,
        }

        if include_items:
            response["payments"] = PaymentSerializer(payment_qs.order_by("-created_at"), many=True).data
            response["expenses"] = ExpenseSerializer(expense_qs.order_by("-created_at"), many=True).data

        return Response(response)


class MonthlyDueFeesView(APIView):
    """
    Returns students who still owe the class monthly fee for a given Shamsi month.
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

        class_id = request.query_params.get("class_id")

        monthly_fee_types = FeeType.objects.filter(name__icontains="monthly")
        if not monthly_fee_types.exists():
            return Response(
                {"detail": "Monthly FeeType not found. Create a FeeType with 'monthly' in its name."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        students_qs = Student.objects.select_related("school_class").filter(school_class__isnull=False)
        if class_id:
            students_qs = students_qs.filter(school_class_id=class_id)

        paid_rows = (
            Payment.objects.filter(month_shamsi=month_shamsi, fee_type__in=monthly_fee_types)
            .values("student_id")
            .annotate(paid=Sum("amount"))
        )
        paid_map = {str(row["student_id"]): row["paid"] for row in paid_rows}

        results = []
        for student in students_qs:
            expected = (
                student.monthly_fee_override
                if student.monthly_fee_override is not None
                else student.school_class.monthly_fee
            )
            paid = paid_map.get(str(student.id)) or Decimal("0")
            due = expected - paid
            if due > 0:
                results.append(
                    {
                        "student_id": student.id,
                        "student_name": student.name,
                        "father_name": student.father_name,
                        "grandfather_name": student.grandfather_name,
                        "phone": student.phone,
                        "class_id": student.school_class_id,
                        "class_name": student.school_class.name,
                        "class_year_shamsi": student.school_class.year_shamsi,
                        "expected_monthly_fee": str(expected),
                        "paid_monthly_fee": str(paid),
                        "due_amount": str(due),
                    }
                )

        return Response(
            {
                "month_shamsi": month_shamsi,
                "total_due_students": len(results),
                "results": results,
            }
        )


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
    required_fields = ["name", "father_name", "grandfather_name", "phone"]
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

    if errors:
        return None, errors

    student = Student(
        school_class=school_class,
        name=str(row.get("name", "")).strip(),
        father_name=str(row.get("father_name", "")).strip(),
        grandfather_name=str(row.get("grandfather_name", "")).strip(),
        phone=phone,
        monthly_fee_override=monthly_fee_override,
        transport_fee_override=transport_fee_override,
        uniform_fee_override=uniform_fee_override,
        book_fee_override=book_fee_override,
    )
    return student, []
