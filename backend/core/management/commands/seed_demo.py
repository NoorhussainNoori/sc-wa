"""
Load demo school data for local testing (backup / restore, reports, dues).

Safe to run multiple times: uses get_or_create on unique keys. Demo rows are tagged
with registration numbers DEMO-* , class names "Demo …", etc.
"""

from __future__ import annotations

from decimal import Decimal

import jdatetime
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Expense, ExpenseCategory, FeeType, Payment, SchoolClass, Student, Teacher


class Command(BaseCommand):
    help = "Create demo classes, students, teachers, fee types, payments, and expenses."

    def add_arguments(self, parser):
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Remove previously seeded demo rows (DEMO-* students and related), then re-seed.",
        )

    def handle(self, *args, **options):
        with transaction.atomic():
            if options["replace"]:
                self._purge_demo()
            fee_monthly, fee_transport, fee_uniform, fee_other = self._seed_fee_types()
            cat_rent, cat_supplies = self._seed_expense_categories()
            class_a, class_b = self._seed_classes()
            students = self._seed_students(class_a, class_b)
            self._seed_teachers()
            self._seed_payments(students, fee_monthly, fee_transport, fee_uniform, fee_other)
            self._seed_expenses(cat_rent, cat_supplies)

        self.stdout.write(
            self.style.SUCCESS(
                "Demo data ready. Export: python manage.py export_backup demo.json "
                "then flush + import_backup to verify restore."
            )
        )

    def _purge_demo(self) -> None:
        qs = Student.objects.filter(registration_number__startswith="DEMO-")
        n_stu = qs.count()
        qs.delete()
        Expense.objects.filter(paid_by="Demo cashier").delete()
        n_cls, _ = SchoolClass.objects.filter(name__startswith="Demo ").delete()
        n_teach, _ = Teacher.objects.filter(email__endswith="@demo-seed.local").delete()
        n_cat, _ = ExpenseCategory.objects.filter(name__startswith="Demo ").delete()
        n_ft, _ = FeeType.objects.filter(name__startswith="Demo ").delete()
        self.stdout.write(
            self.style.WARNING(
                f"Removed demo: {n_stu} students, classes={n_cls}, teachers={n_teach}, "
                f"expense categories={n_cat}, fee types={n_ft}."
            )
        )

    def _seed_fee_types(self) -> tuple[FeeType, FeeType, FeeType, FeeType]:
        monthly, _ = FeeType.objects.get_or_create(
            name="Demo Monthly",
            defaults={"requires_reason": False, "is_active": True},
        )
        transport, _ = FeeType.objects.get_or_create(
            name="Demo Transport",
            defaults={"requires_reason": False, "is_active": True},
        )
        uniform, _ = FeeType.objects.get_or_create(
            name="Demo Uniform",
            defaults={"requires_reason": False, "is_active": True},
        )
        other, _ = FeeType.objects.get_or_create(
            name="Demo Other",
            defaults={"requires_reason": True, "is_active": True},
        )
        return monthly, transport, uniform, other

    def _seed_expense_categories(self) -> tuple[ExpenseCategory, ExpenseCategory]:
        rent, _ = ExpenseCategory.objects.get_or_create(
            name="Demo Rent",
            defaults={"is_active": True},
        )
        supplies, _ = ExpenseCategory.objects.get_or_create(
            name="Demo Supplies",
            defaults={"is_active": True},
        )
        return rent, supplies

    def _seed_classes(self) -> tuple[SchoolClass, SchoolClass]:
        class_a, _ = SchoolClass.objects.get_or_create(
            name="Demo Class A",
            year_shamsi="1404",
            defaults={
                "monthly_fee": Decimal("1200.00"),
                "transport_fee": Decimal("300.00"),
                "uniform_fee": Decimal("150.00"),
                "book_fee": Decimal("100.00"),
                "is_active": True,
            },
        )
        class_b, _ = SchoolClass.objects.get_or_create(
            name="Demo Class B",
            year_shamsi="1404",
            defaults={
                "monthly_fee": Decimal("1000.00"),
                "transport_fee": Decimal("250.00"),
                "uniform_fee": Decimal("150.00"),
                "book_fee": Decimal("100.00"),
                "is_active": True,
            },
        )
        return class_a, class_b

    def _seed_students(self, class_a: SchoolClass, class_b: SchoolClass) -> list[Student]:
        specs = [
            {
                "registration_number": "DEMO-1404-001",
                "school_class": class_a,
                "name": "Demo Student One",
                "father_name": "Father One",
                "grandfather_name": "GF One",
                "phone": "700000001",
                "overrides": {},
            },
            {
                "registration_number": "DEMO-1404-002",
                "school_class": class_a,
                "name": "Demo Student Two",
                "father_name": "Father Two",
                "grandfather_name": "GF Two",
                "phone": "700000002",
                "overrides": {},
            },
            {
                "registration_number": "DEMO-1404-003",
                "school_class": class_b,
                "name": "Demo Student Three",
                "father_name": "Father Three",
                "grandfather_name": "GF Three",
                "phone": "700000003",
                "overrides": {},
            },
            {
                "registration_number": "DEMO-1404-004",
                "school_class": class_b,
                "name": "Demo Free Student",
                "father_name": "Father Four",
                "grandfather_name": "GF Four",
                "phone": "700000004",
                "overrides": {
                    "monthly_fee_override": Decimal("0"),
                    "transport_fee_override": Decimal("0"),
                },
            },
        ]
        out: list[Student] = []
        for spec in specs:
            reg = spec["registration_number"]
            defaults = {
                "school_class": spec["school_class"],
                "name": spec["name"],
                "father_name": spec["father_name"],
                "grandfather_name": spec["grandfather_name"],
                "phone": spec["phone"],
                **spec["overrides"],
            }
            st, _ = Student.objects.update_or_create(
                registration_number=reg,
                defaults=defaults,
            )
            out.append(st)
        return out

    def _seed_teachers(self) -> None:
        Teacher.objects.get_or_create(
            email="ahmad.khan@demo-seed.local",
            defaults={
                "name": "Demo Teacher Ahmad",
                "father_name": "Karim",
                "phone": "710000001",
                "address": "Kabul — demo address",
                "salary": Decimal("25000.00"),
                "department": "Mathematics",
            },
        )
        Teacher.objects.get_or_create(
            email="sara.joy@demo-seed.local",
            defaults={
                "name": "Demo Teacher Sara",
                "father_name": "Noor",
                "phone": "710000002",
                "address": "Herat — demo address",
                "salary": Decimal("22000.00"),
                "department": "Science",
            },
        )

    def _seed_payments(
        self,
        students: list[Student],
        fee_monthly: FeeType,
        fee_transport: FeeType,
        fee_uniform: FeeType,
        fee_other: FeeType,
    ) -> None:
        s0, s1, s2 = students[0], students[1], students[2]
        d1 = jdatetime.date(1404, 9, 5)
        d2 = jdatetime.date(1404, 9, 18)
        d3 = jdatetime.date(1404, 11, 10)

        def pay(
            student: Student,
            fee: FeeType,
            amount: Decimal,
            d: jdatetime.date,
            *,
            bill_number: str,
            other_reason: str = "",
        ):
            Payment.objects.get_or_create(
                student=student,
                fee_type=fee,
                bill_number=bill_number,
                defaults={
                    "amount": amount,
                    "date_shamsi": d,
                    "notes": "demo seed",
                    "other_reason": other_reason,
                },
            )

        pay(s0, fee_monthly, Decimal("1200.00"), d1, bill_number="910001")
        pay(s0, fee_transport, Decimal("300.00"), d1, bill_number="910002")
        pay(s1, fee_monthly, Decimal("600.00"), d2, bill_number="910003")
        pay(s2, fee_uniform, Decimal("150.00"), d2, bill_number="910004")
        pay(
            s1,
            fee_other,
            Decimal("200.00"),
            d3,
            bill_number="910005",
            other_reason="Demo adjustment",
        )

    def _seed_expenses(self, cat_rent: ExpenseCategory, cat_supplies: ExpenseCategory) -> None:
        d1 = jdatetime.date(1404, 8, 1)
        d2 = jdatetime.date(1404, 10, 15)
        Expense.objects.get_or_create(
            category=cat_rent,
            amount=Decimal("5000.00"),
            date_shamsi=d1,
            paid_by="Demo cashier",
            defaults={"description": "Demo monthly rent"},
        )
        Expense.objects.get_or_create(
            category=cat_supplies,
            amount=Decimal("450.00"),
            date_shamsi=d2,
            paid_by="Demo cashier",
            defaults={"description": "Demo chalk and paper"},
        )
