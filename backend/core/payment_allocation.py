"""
Allocate Monthly / Transport payments to Shamsi months (FIFO + optional month name in reason).

Dues reports credit payments by `month_shamsi`, not payment date or free-text reason.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable

import jdatetime
from django.db import transaction
from django.utils import timezone

from .models import FeeType, Payment, Student


SHAMSI_MONTH_ALIASES: dict[str, tuple[str, ...]] = {
    "01": ("hamal", "حمل"),
    "02": ("sawar", "sawer", "sawr", "thawr", "ثور"),
    "03": ("jawza", "jawzaa", "joza", "جوزا"),
    "04": ("saratan", "sartan", "سرطان"),
    "05": ("asad", "assad", "اسد"),
    "06": ("sanbula", "sonbola", "سنبله", "سنبل"),
    "07": ("mizan", "mezan", "میزان"),
    "08": ("aqrab", "akrab", "عقرب"),
    "09": ("qaws", "qawss", "quas", "قوس"),
    "10": ("jadi", "jady", "جدی"),
    "11": ("dalw", "dalwa", "dalo", "دلو"),
    "12": ("hoot", "hut", "حوت"),
}


@dataclass
class PaymentEvent:
    """One payment line as entered (before month allocation)."""

    amount: Decimal
    date_shamsi: jdatetime.date
    bill_number: str
    notes: str
    other_reason: str
    fee_type_id: int
    school_class_id: int | None
    created_at: timezone.datetime | None = None
    source_id: int | None = None


@dataclass
class AllocatedPaymentRow:
    month_shamsi: str
    amount: Decimal
    date_shamsi: jdatetime.date
    bill_number: str
    notes: str
    other_reason: str
    fee_type_id: int
    school_class_id: int | None
    created_at: timezone.datetime | None = None
    source_id: int | None = None


def current_shamsi_month() -> str:
    today = jdatetime.date.today()
    return f"{today.year:04d}-{today.month:02d}"


def parse_shamsi_month(month_shamsi: str) -> tuple[int, int]:
    year_str, month_str = month_shamsi.split("-", 1)
    year = int(year_str)
    month = int(month_str)
    if month < 1 or month > 12:
        raise ValueError("Month must be between 01 and 12.")
    return year, month


def iter_shamsi_months(start_month: str, end_month: str) -> list[str]:
    start_year, start_num = parse_shamsi_month(start_month)
    end_year, end_num = parse_shamsi_month(end_month)
    if (start_year, start_num) > (end_year, end_num):
        return []

    months: list[str] = []
    year, month = start_year, start_num
    while (year, month) <= (end_year, end_num):
        months.append(f"{year:04d}-{month:02d}")
        month += 1
        if month > 12:
            year += 1
            month = 1
    return months


def previous_shamsi_month(month_shamsi: str) -> str:
    year, month = parse_shamsi_month(month_shamsi)
    month -= 1
    if month < 1:
        year -= 1
        month = 12
    return f"{year:04d}-{month:02d}"


def student_enrolled_month_shamsi(student: Student) -> str:
    enrolled = jdatetime.datetime.fromgregorian(datetime=timezone.localtime(student.created_at))
    return f"{enrolled.year:04d}-{enrolled.month:02d}"


def student_deactivated_month_shamsi(student: Student) -> str | None:
    if not student.deactivated_at:
        return None
    deactivated = jdatetime.datetime.fromgregorian(datetime=timezone.localtime(student.deactivated_at))
    return f"{deactivated.year:04d}-{deactivated.month:02d}"


def student_reporting_end_month_shamsi(student: Student, requested_month_shamsi: str) -> str:
    end_month_shamsi = requested_month_shamsi
    deactivated_month_shamsi = student_deactivated_month_shamsi(student)
    if not student.is_active and deactivated_month_shamsi:
        cutoff_month_shamsi = previous_shamsi_month(deactivated_month_shamsi)
        if cutoff_month_shamsi < end_month_shamsi:
            end_month_shamsi = cutoff_month_shamsi
    return end_month_shamsi


def student_billable_months(student: Student, through_month: str | None = None) -> list[str]:
    end_month = through_month or current_shamsi_month()
    end_month = student_reporting_end_month_shamsi(student, end_month)
    year = end_month.split("-", 1)[0]
    start_month = max(student_enrolled_month_shamsi(student), f"{year}-01")
    if start_month > end_month:
        return []
    return iter_shamsi_months(start_month, end_month)


def fee_category(name: str) -> str | None:
    lowered = (name or "").lower()
    if "monthly" in lowered:
        return "monthly"
    if "transport" in lowered:
        return "transport"
    return None


def is_allocatable_fee_type(fee_type: FeeType | None) -> bool:
    if not fee_type:
        return False
    return fee_category(fee_type.name) is not None


def monthly_fee_types() -> Iterable[FeeType]:
    return FeeType.objects.filter(name__icontains="monthly")


def transport_fee_types() -> Iterable[FeeType]:
    return FeeType.objects.filter(name__icontains="transport")


def fee_types_for_category(category: str):
    if category == "monthly":
        return monthly_fee_types()
    if category == "transport":
        return transport_fee_types()
    raise ValueError(f"Unknown fee category: {category}")


def student_expected_fee(student: Student, category: str) -> Decimal:
    if not student.school_class_id:
        return Decimal("0")
    if category == "monthly":
        if student.monthly_fee_override is not None:
            return student.monthly_fee_override
        return student.school_class.monthly_fee
    if category == "transport":
        if student.transport_fee_override is not None:
            return student.transport_fee_override
        return student.school_class.transport_fee
    raise ValueError(f"Unknown fee category: {category}")


def normalize_month_token(value: str) -> str:
    return "".join(ch for ch in (value or "").strip().lower() if ch.isalnum() or ord(ch) > 127)


def parse_month_shamsi_from_reason(other_reason: str, year: int) -> str | None:
    token = normalize_month_token(other_reason)
    if not token:
        return None
    for month_num, aliases in SHAMSI_MONTH_ALIASES.items():
        for alias in aliases:
            alias_token = normalize_month_token(alias)
            if token == alias_token or token.startswith(alias_token) or alias_token in token:
                return f"{year:04d}-{month_num}"
    return None


def payment_to_event(payment: Payment) -> PaymentEvent:
    return PaymentEvent(
        amount=payment.amount,
        date_shamsi=payment.date_shamsi,
        bill_number=payment.bill_number or "",
        notes=payment.notes or "",
        other_reason=payment.other_reason or "",
        fee_type_id=payment.fee_type_id,
        school_class_id=payment.school_class_id,
        created_at=payment.created_at,
        source_id=payment.id,
    )


def event_sort_key(event: PaymentEvent) -> tuple:
    created = event.created_at or timezone.now()
    return (event.date_shamsi, created, event.source_id or 0)


def allocate_event(
    event: PaymentEvent,
    *,
    billable_months: list[str],
    expected_fee: Decimal,
    paid_by_month: dict[str, Decimal],
) -> list[AllocatedPaymentRow]:
    if event.amount <= 0 or not billable_months:
        return []

    remaining = event.amount
    rows: list[AllocatedPaymentRow] = []
    year = event.date_shamsi.year

    target_month = parse_month_shamsi_from_reason(event.other_reason, year)
    if target_month and target_month in billable_months:
        chunk = remaining
        rows.append(_row_from_event(event, target_month, chunk))
        paid_by_month[target_month] = paid_by_month.get(target_month, Decimal("0")) + chunk
        remaining = Decimal("0")

    if remaining > 0:
        for month in billable_months:
            if remaining <= 0:
                break
            already_paid = paid_by_month.get(month, Decimal("0"))
            shortfall = max(expected_fee - already_paid, Decimal("0"))
            if shortfall <= 0:
                continue
            chunk = min(remaining, shortfall)
            rows.append(_row_from_event(event, month, chunk))
            paid_by_month[month] = already_paid + chunk
            remaining -= chunk

    if remaining > 0:
        fallback_month = f"{event.date_shamsi.year:04d}-{event.date_shamsi.month:02d}"
        if fallback_month not in billable_months:
            fallback_month = billable_months[-1]
        rows.append(_row_from_event(event, fallback_month, remaining))
        paid_by_month[fallback_month] = paid_by_month.get(fallback_month, Decimal("0")) + remaining

    return rows


def _row_from_event(event: PaymentEvent, month_shamsi: str, amount: Decimal) -> AllocatedPaymentRow:
    return AllocatedPaymentRow(
        month_shamsi=month_shamsi,
        amount=amount,
        date_shamsi=event.date_shamsi,
        bill_number=event.bill_number,
        notes=event.notes,
        other_reason=event.other_reason,
        fee_type_id=event.fee_type_id,
        school_class_id=event.school_class_id,
        created_at=event.created_at,
        source_id=event.source_id,
    )


def replay_events(
    student: Student,
    category: str,
    events: list[PaymentEvent],
    *,
    through_month: str | None = None,
) -> list[AllocatedPaymentRow]:
    if not events:
        return []

    billable_months = student_billable_months(student, through_month)
    expected_fee = student_expected_fee(student, category)
    paid_by_month: dict[str, Decimal] = {month: Decimal("0") for month in billable_months}

    rows: list[AllocatedPaymentRow] = []
    for event in sorted(events, key=event_sort_key):
        rows.extend(
            allocate_event(
                event,
                billable_months=billable_months,
                expected_fee=expected_fee,
                paid_by_month=paid_by_month,
            )
        )
    return rows


def replay_student_category(
    student: Student,
    category: str,
    *,
    through_month: str | None = None,
) -> list[AllocatedPaymentRow]:
    fee_types = fee_types_for_category(category)
    payments = (
        Payment.objects.filter(student=student, fee_type__in=fee_types)
        .select_related("fee_type")
        .order_by("date_shamsi", "created_at", "id")
    )
    events = [payment_to_event(payment) for payment in payments]
    return replay_events(student, category, events, through_month=through_month)


def _row_signature(row: AllocatedPaymentRow | Payment) -> tuple:
    if isinstance(row, AllocatedPaymentRow):
        return (
            row.month_shamsi,
            str(row.amount),
            str(row.date_shamsi),
            row.bill_number,
            row.notes,
            row.other_reason,
            row.fee_type_id,
        )
    return (
        row.month_shamsi,
        str(row.amount),
        str(row.date_shamsi),
        row.bill_number or "",
        row.notes or "",
        row.other_reason or "",
        row.fee_type_id,
    )


def rows_equal(existing: Payment, target: AllocatedPaymentRow) -> bool:
    return _row_signature(existing) == _row_signature(target)


def replace_student_category_payments(
    student: Student,
    category: str,
    target_rows: list[AllocatedPaymentRow],
    *,
    dry_run: bool = False,
) -> dict:
    fee_types = fee_types_for_category(category)
    existing = list(
        Payment.objects.filter(student=student, fee_type__in=fee_types).order_by("date_shamsi", "created_at", "id")
    )

    changed = 0
    for index, target in enumerate(target_rows):
        if index < len(existing):
            current = existing[index]
            if rows_equal(current, target):
                continue
            changed += 1
            if not dry_run:
                current.month_shamsi = target.month_shamsi
                current.amount = target.amount
                current.date_shamsi = target.date_shamsi
                current.bill_number = target.bill_number
                current.notes = target.notes
                current.other_reason = target.other_reason
                current.school_class_id = target.school_class_id
                current.save()
        else:
            changed += 1
            if not dry_run:
                Payment.objects.create(
                    student=student,
                    fee_type_id=target.fee_type_id,
                    school_class_id=target.school_class_id,
                    bill_number=target.bill_number,
                    amount=target.amount,
                    date_shamsi=target.date_shamsi,
                    month_shamsi=target.month_shamsi,
                    notes=target.notes,
                    other_reason=target.other_reason,
                    created_at=target.created_at or timezone.now(),
                )

    deleted = max(len(existing) - len(target_rows), 0)
    if deleted:
        changed += deleted
        if not dry_run:
            for payment in existing[len(target_rows) :]:
                payment.delete()

    return {
        "category": category,
        "existing_count": len(existing),
        "target_count": len(target_rows),
        "changed": changed,
    }


def replay_and_replace_student_category(
    student: Student,
    category: str,
    *,
    through_month: str | None = None,
    dry_run: bool = False,
) -> dict:
    target_rows = replay_student_category(student, category, through_month=through_month)
    stats = replace_student_category_payments(student, category, target_rows, dry_run=dry_run)
    stats["student_id"] = student.id
    stats["student_name"] = student.name
    stats["registration_number"] = student.registration_number
    return stats


@transaction.atomic
def replay_allocatable_payments_for_student(
    student: Student,
    *,
    categories: Iterable[str] | None = None,
    through_month: str | None = None,
    dry_run: bool = False,
) -> list[dict]:
    selected = list(categories or ("monthly", "transport"))
    results = []
    for category in selected:
        results.append(
            replay_and_replace_student_category(
                student,
                category,
                through_month=through_month,
                dry_run=dry_run,
            )
        )
    return results


def replay_after_payment_change(
    student: Student,
    fee_type: FeeType,
    *,
    dry_run: bool = False,
) -> list[dict]:
    category = fee_category(fee_type.name)
    if not category:
        return []
    return replay_allocatable_payments_for_student(student, categories=[category], dry_run=dry_run)
