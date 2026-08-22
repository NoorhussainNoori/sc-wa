"""
Capture or compare payment/allocation state for before/after fix_payment_months runs.
"""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import jdatetime
from django.core.management.base import BaseCommand
from django.db.models import Count, Q, Sum
from django.utils import timezone

from core.models import FeeType, Payment, Student
from core.payment_allocation import (
    current_shamsi_month,
    fee_types_for_category,
    replay_student_category,
    student_billable_months,
    student_expected_fee,
    student_reporting_end_month_shamsi,
)


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj.quantize(Decimal("0.01")))
        if isinstance(obj, jdatetime.date):
            return str(obj)
        return super().default(obj)


def _snapshot_dir() -> Path:
    path = Path(__file__).resolve().parents[3] / "snapshots"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _money(value) -> Decimal:
    if value in (None, ""):
        return Decimal("0")
    return Decimal(str(value))


def _student_dues_through_month(student: Student, through_month: str) -> dict:
    end_month = student_reporting_end_month_shamsi(student, through_month)
    months = student_billable_months(student, end_month)
    if not months:
        return {
            "due_monthly": "0.00",
            "due_transport": "0.00",
            "due_total": "0.00",
            "paid_monthly_by_month": {},
            "paid_transport_by_month": {},
        }

    monthly_types = fee_types_for_category("monthly")
    transport_types = fee_types_for_category("transport")
    expected_m = student_expected_fee(student, "monthly")
    expected_t = student_expected_fee(student, "transport")

    paid_m = {}
    paid_t = {}
    for row in (
        Payment.objects.filter(student=student, fee_type__in=monthly_types, month_shamsi__in=months)
        .values("month_shamsi")
        .annotate(total=Sum("amount"))
    ):
        paid_m[row["month_shamsi"]] = _money(row["total"])

    for row in (
        Payment.objects.filter(student=student, fee_type__in=transport_types, month_shamsi__in=months)
        .values("month_shamsi")
        .annotate(total=Sum("amount"))
    ):
        paid_t[row["month_shamsi"]] = _money(row["total"])

    due_m = Decimal("0")
    due_t = Decimal("0")
    for month in months:
        due_m += max(expected_m - paid_m.get(month, Decimal("0")), Decimal("0"))
        due_t += max(expected_t - paid_t.get(month, Decimal("0")), Decimal("0"))

    return {
        "due_monthly": str(due_m.quantize(Decimal("0.01"))),
        "due_transport": str(due_t.quantize(Decimal("0.01"))),
        "due_total": str((due_m + due_t).quantize(Decimal("0.01"))),
        "paid_monthly_by_month": {k: str(v) for k, v in sorted(paid_m.items())},
        "paid_transport_by_month": {k: str(v) for k, v in sorted(paid_t.items())},
    }


def build_snapshot(*, through_month: str | None = None) -> dict:
    through = through_month or current_shamsi_month()
    now = timezone.now()

    monthly_types = fee_types_for_category("monthly")
    transport_types = fee_types_for_category("transport")

    students_qs = Student.objects.select_related("school_class").filter(school_class__isnull=False)
    active_students = students_qs.filter(is_active=True).count()
    total_students = students_qs.count()

    payment_totals_by_fee = {}
    for row in Payment.objects.values("fee_type__name").annotate(count=Count("id"), total=Sum("amount")).order_by("fee_type__name"):
        payment_totals_by_fee[row["fee_type__name"]] = {
            "count": row["count"],
            "total": str(_money(row["total"]).quantize(Decimal("0.01"))),
        }

    monthly_by_month = {}
    for row in (
        Payment.objects.filter(fee_type__in=monthly_types)
        .values("month_shamsi")
        .annotate(count=Count("id"), total=Sum("amount"))
        .order_by("month_shamsi")
    ):
        monthly_by_month[row["month_shamsi"]] = {
            "count": row["count"],
            "total": str(_money(row["total"]).quantize(Decimal("0.01"))),
        }

    transport_by_month = {}
    for row in (
        Payment.objects.filter(fee_type__in=transport_types)
        .values("month_shamsi")
        .annotate(count=Count("id"), total=Sum("amount"))
        .order_by("month_shamsi")
    ):
        transport_by_month[row["month_shamsi"]] = {
            "count": row["count"],
            "total": str(_money(row["total"]).quantize(Decimal("0.01"))),
        }

    zero_amount_payments = Payment.objects.filter(amount=Decimal("0")).count()
    zero_monthly = Payment.objects.filter(fee_type__in=monthly_types, amount=Decimal("0")).count()
    zero_transport = Payment.objects.filter(fee_type__in=transport_types, amount=Decimal("0")).count()

    grand_total_payments = Payment.objects.count()
    grand_total_amount = _money(Payment.objects.aggregate(t=Sum("amount"))["t"]).quantize(Decimal("0.01"))

    monthly_grand = _money(
        Payment.objects.filter(fee_type__in=monthly_types).aggregate(t=Sum("amount"))["t"]
    ).quantize(Decimal("0.01"))
    transport_grand = _money(
        Payment.objects.filter(fee_type__in=transport_types).aggregate(t=Sum("amount"))["t"]
    ).quantize(Decimal("0.01"))

    # Students with allocatable payments
    allocatable_student_ids = set(
        Payment.objects.filter(
            Q(fee_type__in=monthly_types) | Q(fee_type__in=transport_types)
        ).values_list("student_id", flat=True)
    )

    students_would_change = []
    total_due_monthly = Decimal("0")
    total_due_transport = Decimal("0")
    students_with_due = 0

    for student in students_qs.order_by("registration_number"):
        dues = _student_dues_through_month(student, through)
        due_total = Decimal(dues["due_total"])
        if due_total > 0:
            students_with_due += 1
            total_due_monthly += Decimal(dues["due_monthly"])
            total_due_transport += Decimal(dues["due_transport"])

        if student.id not in allocatable_student_ids:
            continue

        change_info = {"monthly": None, "transport": None}
        student_changed = False
        for category in ("monthly", "transport"):
            fee_types = fee_types_for_category(category)
            existing = list(
                Payment.objects.filter(student=student, fee_type__in=fee_types).order_by(
                    "date_shamsi", "created_at", "id"
                )
            )
            if not existing:
                continue
            existing_sum = sum((p.amount for p in existing), Decimal("0"))
            target = replay_student_category(student, category, through_month=through)
            target_sum = sum((r.amount for r in target), Decimal("0"))

            existing_sig = [
                (p.month_shamsi, str(p.amount), p.other_reason or "", str(p.date_shamsi)) for p in existing
            ]
            target_sig = [
                (r.month_shamsi, str(r.amount), r.other_reason or "", str(r.date_shamsi)) for r in target
            ]
            changed = existing_sig != target_sig or len(existing) != len(target)
            if changed:
                student_changed = True
                change_info[category] = {
                    "existing_rows": len(existing),
                    "target_rows": len(target),
                    "existing_total": str(existing_sum.quantize(Decimal("0.01"))),
                    "target_total": str(target_sum.quantize(Decimal("0.01"))),
                    "amount_preserved": existing_sum == target_sum,
                }

        if student_changed:
            students_would_change.append(
                {
                    "student_id": student.id,
                    "registration_number": student.registration_number,
                    "name": student.name,
                    "class_name": student.school_class.name if student.school_class else "",
                    "changes": change_info,
                    "dues_through": dues,
                }
            )

    payment_rows_checksum = []
    for p in Payment.objects.select_related("fee_type").order_by("id"):
        payment_rows_checksum.append(
            {
                "id": p.id,
                "student_id": p.student_id,
                "fee_type": p.fee_type.name if p.fee_type_id else "",
                "amount": str(p.amount),
                "month_shamsi": p.month_shamsi,
                "date_shamsi": str(p.date_shamsi),
                "bill_number": p.bill_number or "",
                "other_reason": p.other_reason or "",
            }
        )

    return {
        "meta": {
            "label": "payment_baseline",
            "captured_at_utc": now.isoformat(),
            "captured_at_shamsi": str(jdatetime.datetime.fromgregorian(datetime=now)),
            "through_month_shamsi": through,
        },
        "kpis": {
            "total_students_with_class": total_students,
            "active_students_with_class": active_students,
            "total_payment_rows": grand_total_payments,
            "total_payment_amount": str(grand_total_amount),
            "monthly_payment_amount": str(monthly_grand),
            "transport_payment_amount": str(transport_grand),
            "zero_amount_payment_rows": zero_amount_payments,
            "zero_amount_monthly_rows": zero_monthly,
            "zero_amount_transport_rows": zero_transport,
            "students_with_due_through_month": students_with_due,
            "aggregate_due_monthly": str(total_due_monthly.quantize(Decimal("0.01"))),
            "aggregate_due_transport": str(total_due_transport.quantize(Decimal("0.01"))),
            "aggregate_due_total": str((total_due_monthly + total_due_transport).quantize(Decimal("0.01"))),
            "students_would_change_on_fix": len(students_would_change),
            "payment_rows_in_checksum": len(payment_rows_checksum),
        },
        "payments_by_fee_type": payment_totals_by_fee,
        "monthly_by_month_shamsi": monthly_by_month,
        "transport_by_month_shamsi": transport_by_month,
        "students_would_change": students_would_change,
        "payment_rows": payment_rows_checksum,
    }


def compare_snapshots(before: dict, after: dict) -> dict:
    b_kpi = before["kpis"]
    a_kpi = after["kpis"]

    kpi_diff = {}
    for key in b_kpi:
        if b_kpi[key] != a_kpi.get(key):
            kpi_diff[key] = {"before": b_kpi[key], "after": a_kpi.get(key)}

    before_by_reg = {s["registration_number"]: s for s in before.get("students_would_change", [])}
    after_by_reg = {s["registration_number"]: s for s in after.get("students_would_change", [])}

    due_changes = []
    for student in Student.objects.select_related("school_class").filter(school_class__isnull=False):
        reg = student.registration_number
        b_due = before_by_reg.get(reg, {}).get("dues_through") or _student_dues_through_month(
            student, before["meta"]["through_month_shamsi"]
        )
        # Re-read from after snapshot's stored would_change dues if present, else compute live
        if reg in after_by_reg:
            a_due = after_by_reg[reg]["dues_through"]
        else:
            a_due = _student_dues_through_month(student, after["meta"]["through_month_shamsi"])

        if b_due.get("due_total") != a_due.get("due_total"):
            due_changes.append(
                {
                    "registration_number": reg,
                    "name": student.name,
                    "due_total_before": b_due.get("due_total"),
                    "due_total_after": a_due.get("due_total"),
                    "due_monthly_before": b_due.get("due_monthly"),
                    "due_monthly_after": a_due.get("due_monthly"),
                    "due_transport_before": b_due.get("due_transport"),
                    "due_transport_after": a_due.get("due_transport"),
                }
            )

    before_rows = {r["id"]: r for r in before["payment_rows"]}
    after_rows = {r["id"]: r for r in after["payment_rows"]}

    amount_mismatches = []
    for pid, brow in before_rows.items():
        arow = after_rows.get(pid)
        if not arow:
            continue
        if brow["amount"] != arow["amount"]:
            amount_mismatches.append({"id": pid, "before": brow["amount"], "after": arow["amount"]})

    deleted_ids = sorted(set(before_rows) - set(after_rows))
    created_ids = sorted(set(after_rows) - set(before_rows))

    before_amount_by_student_fee = {}
    after_amount_by_student_fee = {}
    for rows, target in ((before_rows.values(), before_amount_by_student_fee), (after_rows.values(), after_amount_by_student_fee)):
        for r in rows:
            key = (r["student_id"], r["fee_type"])
            target[key] = target.get(key, Decimal("0")) + Decimal(r["amount"])

    student_fee_amount_shifts = []
    all_keys = set(before_amount_by_student_fee) | set(after_amount_by_student_fee)
    for key in sorted(all_keys):
        b = before_amount_by_student_fee.get(key, Decimal("0"))
        a = after_amount_by_student_fee.get(key, Decimal("0"))
        if b != a:
            student_fee_amount_shifts.append(
                {"student_id": key[0], "fee_type": key[1], "before": str(b), "after": str(a)}
            )

    return {
        "kpi_diff": kpi_diff,
        "due_total_changes_count": len(due_changes),
        "due_total_changes": sorted(due_changes, key=lambda x: abs(Decimal(x["due_total_after"]) - Decimal(x["due_total_before"])), reverse=True)[:100],
        "payment_amount_mismatches_on_same_id": amount_mismatches,
        "deleted_payment_ids_count": len(deleted_ids),
        "created_payment_ids_count": len(created_ids),
        "student_fee_amount_shifts_count": len(student_fee_amount_shifts),
        "student_fee_amount_shifts": student_fee_amount_shifts[:50],
        "issues": [
            msg
            for msg, cond in [
                ("Monthly grand total changed", b_kpi["monthly_payment_amount"] != a_kpi["monthly_payment_amount"]),
                ("Transport grand total changed", b_kpi["transport_payment_amount"] != a_kpi["transport_payment_amount"]),
                ("Total payment amount changed", b_kpi["total_payment_amount"] != a_kpi["total_payment_amount"]),
                ("Same payment id amount changed", bool(amount_mismatches)),
                ("Student fee totals shifted", bool(student_fee_amount_shifts)),
            ]
            if cond
        ],
    }


class Command(BaseCommand):
    help = "Capture or compare payment state snapshots (before/after fix_payment_months)."

    def add_arguments(self, parser):
        parser.add_argument(
            "action",
            choices=["capture", "compare"],
            help="capture = save baseline; compare = diff two snapshot files",
        )
        parser.add_argument(
            "--label",
            default="before_fix",
            help="Label embedded in snapshot filename (capture mode).",
        )
        parser.add_argument(
            "--through-month",
            type=str,
            help="Dues/reporting through this Shamsi month YYYY-MM.",
        )
        parser.add_argument("--before", type=str, help="Path to before snapshot JSON (compare mode).")
        parser.add_argument("--after", type=str, help="Path to after snapshot JSON (compare mode).")

    def handle(self, *args, **options):
        action = options["action"]

        if action == "capture":
            snapshot = build_snapshot(through_month=options.get("through_month"))
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            label = options["label"].replace(" ", "_")
            filename = f"payment_snapshot_{label}_{timestamp}.json"
            path = _snapshot_dir() / filename
            with path.open("w", encoding="utf-8") as fh:
                json.dump(snapshot, fh, indent=2, ensure_ascii=False, cls=DecimalEncoder)

            kpi = snapshot["kpis"]
            self.stdout.write(self.style.SUCCESS(f"Snapshot saved: {path}"))
            self.stdout.write(f"Through month: {snapshot['meta']['through_month_shamsi']}")
            self.stdout.write(f"Total payment rows: {kpi['total_payment_rows']}")
            self.stdout.write(f"Total payment amount: {kpi['total_payment_amount']}")
            self.stdout.write(f"Monthly amount: {kpi['monthly_payment_amount']}")
            self.stdout.write(f"Transport amount: {kpi['transport_payment_amount']}")
            self.stdout.write(f"Zero-amount rows: {kpi['zero_amount_payment_rows']}")
            self.stdout.write(f"Students with due (through month): {kpi['students_with_due_through_month']}")
            self.stdout.write(f"Aggregate due total: {kpi['aggregate_due_total']}")
            self.stdout.write(f"Students that fix would change: {kpi['students_would_change_on_fix']}")
            return

        before_path = Path(options["before"])
        after_path = Path(options["after"])
        if not before_path.exists() or not after_path.exists():
            self.stderr.write(self.style.ERROR("Both --before and --after snapshot paths must exist."))
            return

        with before_path.open(encoding="utf-8") as fh:
            before = json.load(fh)
        with after_path.open(encoding="utf-8") as fh:
            after = json.load(fh)

        diff = compare_snapshots(before, after)
        diff_path = _snapshot_dir() / f"payment_compare_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with diff_path.open("w", encoding="utf-8") as fh:
            json.dump(diff, fh, indent=2, ensure_ascii=False)

        self.stdout.write(self.style.SUCCESS(f"Comparison saved: {diff_path}"))
        if diff["issues"]:
            self.stdout.write(self.style.WARNING("Potential issues:"))
            for issue in diff["issues"]:
                self.stdout.write(f"  - {issue}")
        else:
            self.stdout.write(self.style.SUCCESS("No money-total issues detected."))

        self.stdout.write(f"KPI changes: {len(diff['kpi_diff'])}")
        for key, vals in diff["kpi_diff"].items():
            self.stdout.write(f"  {key}: {vals['before']} -> {vals['after']}")

        self.stdout.write(f"Students with due total change: {diff['due_total_changes_count']}")
        self.stdout.write(f"Deleted payment rows: {diff['deleted_payment_ids_count']}")
        self.stdout.write(f"Created payment rows: {diff['created_payment_ids_count']}")
