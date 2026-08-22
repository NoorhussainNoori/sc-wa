from django.core.management.base import BaseCommand
from django.db.models import Q

from core.models import Payment, Student
from core.payment_allocation import replay_allocatable_payments_for_student


class Command(BaseCommand):
    help = (
        "Re-allocate Monthly and Transport payments to the correct Shamsi months using FIFO. "
        "Use --dry-run first to review changes."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report changes without writing to the database.",
        )
        parser.add_argument(
            "--student-id",
            type=int,
            help="Fix one student by primary key.",
        )
        parser.add_argument(
            "--registration-number",
            type=str,
            help="Fix one student by registration number.",
        )
        parser.add_argument(
            "--through-month",
            type=str,
            help="Billable months end at this Shamsi month (YYYY-MM). Defaults to today.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        through_month = options.get("through_month")

        students = Student.objects.select_related("school_class").order_by("id")
        if options.get("student_id"):
            students = students.filter(id=options["student_id"])
        if options.get("registration_number"):
            students = students.filter(registration_number=options["registration_number"])

        if not students.exists():
            self.stderr.write(self.style.ERROR("No matching students found."))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no database changes will be made."))

        total_students = 0
        total_changed = 0
        total_updates = 0
        total_deletes = 0
        total_creates = 0

        for student in students:
            has_allocatable = Payment.objects.filter(
                student=student,
            ).filter(
                Q(fee_type__name__icontains="monthly") | Q(fee_type__name__icontains="transport")
            ).exists()
            if not has_allocatable:
                continue

            results = replay_allocatable_payments_for_student(
                student,
                through_month=through_month,
                dry_run=dry_run,
            )
            changed = sum(item["changed"] for item in results)
            if changed <= 0:
                continue

            total_students += 1
            total_changed += changed
            for item in results:
                if item["changed"] <= 0:
                    continue
                delta = item["target_count"] - item["existing_count"]
                if delta > 0:
                    total_creates += delta
                elif delta < 0:
                    total_deletes += abs(delta)
                else:
                    total_updates += item["changed"]

                self.stdout.write(
                    f"{student.registration_number} | {student.name} | {item['category']}: "
                    f"{item['existing_count']} -> {item['target_count']} rows ({item['changed']} changes)"
                )

        if total_students == 0:
            self.stdout.write(self.style.SUCCESS("No payment rows needed changes."))
            return

        summary = (
            f"Students updated: {total_students}. "
            f"Row changes: {total_changed} "
            f"(~{total_updates} updated, ~{total_creates} created, ~{total_deletes} deleted)."
        )
        if dry_run:
            self.stdout.write(self.style.WARNING(summary))
            self.stdout.write("Run again without --dry-run to apply.")
        else:
            self.stdout.write(self.style.SUCCESS(summary))
