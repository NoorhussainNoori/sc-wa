import json
from decimal import Decimal

import jdatetime
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.models import Sum
from django.utils import timezone
from rest_framework.authtoken.models import Token
from django.test import TestCase
from rest_framework.test import APITestCase

from .backup_fixture import repair_backup_fixture_shamsi_dates
from .models import Expense, ExpenseCategory, FeeType, Payment, SchoolClass, Student, Teacher, TeacherSalaryPayment


class TestCoreSmokeTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="tester", password="pass1234")
        self.token = Token.objects.create(user=self.user)

        self.school_class = SchoolClass.objects.create(
            name="Class A",
            year_shamsi="1403",
            monthly_fee=Decimal("1000.00"),
            transport_fee=Decimal("200.00"),
            uniform_fee=Decimal("150.00"),
            book_fee=Decimal("100.00"),
        )

        self.student = Student.objects.create(
            school_class=self.school_class,
            name="Ali",
            registration_number="REG-1001",
            father_name="Reza",
            grandfather_name="Hassan",
            phone="700000000",
            previous_balance=Decimal("300.00"),
            created_at=timezone.make_aware(jdatetime.datetime(1404, 1, 1, 10, 0, 0).togregorian()),
        )

        self.fee_type = FeeType.objects.create(
            name="Monthly Fee",
            requires_reason=False,
            is_active=True,
        )

        self.payment = Payment.objects.create(
            student=self.student,
            fee_type=self.fee_type,
            bill_number="12345",
            amount=Decimal("50.00"),
            date_shamsi=jdatetime.date(1404, 1, 15),
        )

    def test_student_str_stable(self):
        # Regression test: Student.__str__ must not reference non-existent `bill_number`.
        self.assertIn(self.student.father_name, str(self.student))

    def test_endpoints_require_auth(self):
        res = self.client.get(f"/api/students/?q={self.student.name}")
        self.assertEqual(res.status_code, 401)

        res = self.client.get(f"/api/payments/?student_id={self.student.id}")
        self.assertEqual(res.status_code, 401)

    def test_student_search_and_payments_list(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        res = self.client.get(f"/api/students/?q={self.student.name}")
        self.assertEqual(res.status_code, 200)
        self.assertIn("results", res.data)
        returned_ids = {item["id"] for item in res.data["results"]}
        self.assertIn(self.student.id, returned_ids)
        res = self.client.get(f"/api/students/?q={self.student.registration_number}")
        self.assertEqual(res.status_code, 200)
        self.assertIn(self.student.id, {item["id"] for item in res.data["results"]})

        res = self.client.get(f"/api/payments/?student_id={self.student.id}")
        self.assertEqual(res.status_code, 200)
        self.assertIn("results", res.data)
        self.assertGreaterEqual(len(res.data["results"]), 1)
        self.assertEqual(str(res.data["results"][0]["bill_number"]), self.payment.bill_number)

    def test_student_active_filter(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        inactive_student = Student.objects.create(
            school_class=self.school_class,
            name="Inactive Ali",
            registration_number="REG-1999",
            father_name="Reza",
            grandfather_name="Hassan",
            phone="700000009",
            is_active=False,
        )

        res = self.client.get("/api/students/?q=Ali&is_active=1")
        self.assertEqual(res.status_code, 200)
        returned_ids = {item["id"] for item in res.data["results"]}
        self.assertIn(self.student.id, returned_ids)
        self.assertNotIn(inactive_student.id, returned_ids)

    def test_payment_create_treats_json_date_as_shamsi(self):
        """DRF DateField parses YYYY-MM-DD as Gregorian; Shamsi years must use Jalali parsing."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        res = self.client.post(
            "/api/payments/",
            {
                "student": self.student.id,
                "fee_type": self.fee_type.id,
                "bill_number": "99901",
                "amount": "100.00",
                "date_shamsi": "1404-10-13",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["date_shamsi"], "1404-10-13")
        stored = Payment.objects.get(bill_number="99901")
        self.assertEqual(stored.date_shamsi, jdatetime.date(1404, 10, 13))

    def test_students_bulk_import_csv(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        csv_content = (
            "class_id,class_name,year_shamsi,name,registration_number,father_name,grandfather_name,phone\n"
            f"{self.school_class.id},,1403,Zahid,REG-2002,Rahim,Karim,700000123\n"
        ).encode("utf-8")
        upload = SimpleUploadedFile("students.csv", csv_content, content_type="text/csv")

        res = self.client.post("/api/students/import/", {"file": upload, "mode": "partial"}, format="multipart")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["imported"], 1)
        self.assertEqual(Student.objects.filter(name="Zahid").count(), 1)
        self.assertEqual(Student.objects.get(name="Zahid").registration_number, "REG-2002")

    def test_monthly_dues_report(self):
        # Use the month_shamsi value calculated/stored on the Payment record
        month_shamsi = self.payment.month_shamsi
        previous_balance_fee_type, _ = FeeType.objects.get_or_create(
            name="Previous Balance",
            defaults={"requires_reason": False, "is_active": True},
        )
        Payment.objects.create(
            student=self.student,
            fee_type=previous_balance_fee_type,
            bill_number="12340",
            amount=Decimal("100.00"),
            date_shamsi=jdatetime.date(1404, 1, 16),
        )
        monthly_fee_types = FeeType.objects.filter(name__icontains="monthly")
        self.assertTrue(monthly_fee_types.exists())
        # Sanity check: payment must exist for the month + fee type we expect
        paid = (
            Payment.objects.filter(
                month_shamsi=month_shamsi,
                fee_type__in=monthly_fee_types,
                student=self.student,
            ).aggregate(paid=Sum("amount"))["paid"]
            or Decimal("0")
        )
        self.assertEqual(paid, self.payment.amount)

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        res = self.client.get(f"/api/reports/monthly-dues/?month_shamsi={month_shamsi}")
        self.assertEqual(res.status_code, 200)
        self.assertIn("results", res.data)
        self.assertGreaterEqual(len(res.data["results"]), 1)
        first = res.data["results"][0]
        self.assertEqual(first["student_id"], self.student.id)
        expected_monthly = self.school_class.monthly_fee
        # For the first month, "previous" is zero; "current" is the shortfall for that month.
        due_monthly_current = expected_monthly - self.payment.amount
        due_monthly_previous = Decimal("0")
        expected_transport = self.school_class.transport_fee
        due_transport_current = expected_transport
        due_transport_previous = Decimal("0")
        total_due = due_monthly_current + due_transport_current + Decimal("200.00")
        self.assertEqual(first["due_monthly_fee_previous"], str(due_monthly_previous))
        self.assertEqual(first["due_monthly_fee_current"], str(due_monthly_current))
        self.assertEqual(first["due_monthly_fee"], str(due_monthly_previous + due_monthly_current))
        self.assertEqual(first["due_transport_fee_previous"], str(due_transport_previous))
        self.assertEqual(first["due_transport_fee_current"], str(due_transport_current))
        self.assertEqual(
            first["due_transport_fee"],
            str(due_transport_previous + due_transport_current),
        )
        self.assertEqual(first["expected_transport_fee"], str(expected_transport))
        self.assertEqual(first["previous_balance"], "300.00")
        self.assertEqual(first["paid_previous_balance"], "100.00")
        self.assertEqual(first["due_previous_balance"], "200.00")
        self.assertEqual(first["due_amount"], str(total_due))
        self.assertEqual(first["due_monthly_previous_months_count"], 0)
        self.assertEqual(first["due_transport_previous_months_count"], 0)
        self.assertEqual(res.data["dues_from_month_shamsi"], "1404-01")
        self.assertEqual(res.data["months_count"], 1)

    def test_monthly_dues_report_cumulative_hamal_through_selected(self):
        """Baqiāt = sum of per-month shortfalls from 1404-01 through selected month."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        previous_balance_fee_type, _ = FeeType.objects.get_or_create(
            name="Previous Balance",
            defaults={"requires_reason": False, "is_active": True},
        )
        Payment.objects.create(
            student=self.student,
            fee_type=previous_balance_fee_type,
            bill_number="12341",
            amount=Decimal("100.00"),
            date_shamsi=jdatetime.date(1404, 1, 17),
        )
        res = self.client.get("/api/reports/monthly-dues/?month_shamsi=1404-02")
        self.assertEqual(res.status_code, 200)
        first = res.data["results"][0]
        self.assertEqual(first["student_id"], self.student.id)
        # 1404-01: monthly 1000 - 50 paid = 950 (previous), transport 200 (previous)
        # 1404-02: monthly 1000 - 0 = 1000 (current), transport 200 (current)
        self.assertEqual(first["due_monthly_fee_previous"], "950.00")
        self.assertEqual(first["due_monthly_fee_current"], "1000.00")
        self.assertEqual(first["due_monthly_fee"], "1950.00")
        self.assertEqual(first["due_transport_fee_previous"], "200.00")
        self.assertEqual(first["due_transport_fee_current"], "200.00")
        self.assertEqual(first["due_transport_fee"], "400.00")
        self.assertEqual(first["due_previous_balance"], "200.00")
        self.assertEqual(first["due_amount"], "2550.00")
        self.assertEqual(first["due_monthly_previous_months_count"], 1)
        self.assertEqual(first["due_transport_previous_months_count"], 1)
        self.assertEqual(res.data["dues_from_month_shamsi"], "1404-01")
        self.assertEqual(res.data["months_count"], 2)

    def test_monthly_dues_report_starts_from_student_enrollment_month(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        late_student = Student.objects.create(
            school_class=self.school_class,
            name="Hamid",
            registration_number="REG-4004",
            father_name="Jalil",
            grandfather_name="Nasir",
            phone="700000777",
            created_at=timezone.make_aware(jdatetime.datetime(1404, 4, 5, 10, 0, 0).togregorian()),
        )

        res = self.client.get("/api/reports/monthly-dues/?month_shamsi=1404-04")
        self.assertEqual(res.status_code, 200)
        late_row = next(row for row in res.data["results"] if row["student_id"] == late_student.id)

        self.assertEqual(late_row["due_monthly_fee_previous"], "0")
        self.assertEqual(late_row["due_monthly_fee_current"], "1000.00")
        self.assertEqual(late_row["due_monthly_fee"], "1000.00")
        self.assertEqual(late_row["due_transport_fee_previous"], "0")
        self.assertEqual(late_row["due_transport_fee_current"], "200.00")
        self.assertEqual(late_row["due_transport_fee"], "200.00")
        self.assertEqual(late_row["due_monthly_previous_months_count"], 0)
        self.assertEqual(late_row["due_transport_previous_months_count"], 0)
        self.assertEqual(late_row["due_amount"], "1200.00")

    def test_class_monthly_fees_report(self):
        SchoolClass.objects.create(
            name="Z Empty",
            year_shamsi="1405",
            monthly_fee=Decimal("500.00"),
            transport_fee=Decimal("100.00"),
            uniform_fee=Decimal("0"),
            book_fee=Decimal("0"),
        )
        Student.objects.create(
            school_class=self.school_class,
            name="FreeKid",
            registration_number="REG-FREE",
            father_name="F",
            grandfather_name="G",
            phone="700000002",
            monthly_fee_override=Decimal("0"),
            transport_fee_override=Decimal("0"),
            created_at=timezone.make_aware(jdatetime.datetime(1404, 1, 1, 10, 0, 0).togregorian()),
        )
        Student.objects.create(
            school_class=self.school_class,
            name="LeftSchool",
            registration_number="REG-LEFT",
            father_name="X",
            grandfather_name="Y",
            phone="700000003",
            is_active=False,
            deactivated_at=timezone.make_aware(jdatetime.datetime(1404, 1, 5, 10, 0, 0).togregorian()),
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        month_shamsi = self.payment.month_shamsi
        res = self.client.get(f"/api/reports/class-monthly-fees/?month_shamsi={month_shamsi}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["month_shamsi"], month_shamsi)

        row = next(r for r in res.data["classes"] if r["class_id"] == self.school_class.id)
        self.assertEqual(row["student_count"], 2)
        self.assertEqual(row["free_students_count"], 1)
        self.assertEqual(Decimal(row["total_monthly_expected"]), Decimal("1000"))
        self.assertEqual(Decimal(row["total_transport_expected"]), Decimal("200"))
        self.assertEqual(Decimal(row["total_monthly_paid"]), Decimal("50"))
        self.assertEqual(Decimal(row["total_transport_paid"]), Decimal("0"))
        self.assertEqual(Decimal(row["total_monthly_remaining"]), Decimal("950"))
        self.assertEqual(Decimal(row["total_transport_remaining"]), Decimal("200"))

        empty_row = next(r for r in res.data["classes"] if r["class_name"] == "Z Empty")
        self.assertEqual(empty_row["student_count"], 0)
        self.assertEqual(empty_row["free_students_count"], 0)

    def test_monthly_dues_report_excludes_inactive_students(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        inactive_student = Student.objects.create(
            school_class=self.school_class,
            name="LeftSchool",
            registration_number="REG-LEFT2",
            father_name="X",
            grandfather_name="Y",
            phone="700000004",
            is_active=False,
            deactivated_at=timezone.make_aware(jdatetime.datetime(1404, 1, 5, 10, 0, 0).togregorian()),
        )

        res = self.client.get("/api/reports/monthly-dues/?month_shamsi=1404-01")
        self.assertEqual(res.status_code, 200)
        returned_ids = {row["student_id"] for row in res.data["results"]}
        self.assertIn(self.student.id, returned_ids)
        self.assertNotIn(inactive_student.id, returned_ids)

    def test_monthly_dues_report_keeps_arrears_before_deactivation_month(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        inactive_student = Student.objects.create(
            school_class=self.school_class,
            name="Transferred Student",
            registration_number="REG-LEFT3",
            father_name="A",
            grandfather_name="B",
            phone="700000005",
            created_at=timezone.make_aware(jdatetime.datetime(1404, 1, 1, 10, 0, 0).togregorian()),
            is_active=False,
            deactivated_at=timezone.make_aware(jdatetime.datetime(1404, 4, 10, 10, 0, 0).togregorian()),
        )

        res = self.client.get("/api/reports/monthly-dues/?month_shamsi=1404-05")
        self.assertEqual(res.status_code, 200)
        row = next(item for item in res.data["results"] if item["student_id"] == inactive_student.id)
        self.assertEqual(row["due_monthly_fee_previous"], "3000.00")
        self.assertEqual(row["due_monthly_fee_current"], "0")
        self.assertEqual(row["due_transport_fee_previous"], "600.00")
        self.assertEqual(row["due_transport_fee_current"], "0")
        self.assertEqual(row["due_amount"], "3600.00")

    def test_student_statement_report(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        transport_fee_type = FeeType.objects.create(
            name="Transport Fee",
            requires_reason=False,
            is_active=True,
        )
        uniform_fee_type = FeeType.objects.create(
            name="Uniform Fee",
            requires_reason=False,
            is_active=True,
        )
        previous_balance_fee_type, _ = FeeType.objects.get_or_create(
            name="Previous Balance",
            defaults={"requires_reason": False, "is_active": True},
        )
        Payment.objects.create(
            student=self.student,
            fee_type=transport_fee_type,
            bill_number="12346",
            amount=Decimal("20.00"),
            date_shamsi=jdatetime.date(1404, 1, 18),
        )
        Payment.objects.create(
            student=self.student,
            fee_type=uniform_fee_type,
            bill_number="12347",
            amount=Decimal("150.00"),
            date_shamsi=jdatetime.date(1404, 1, 20),
        )
        Payment.objects.create(
            student=self.student,
            fee_type=previous_balance_fee_type,
            bill_number="12348",
            amount=Decimal("100.00"),
            date_shamsi=jdatetime.date(1404, 1, 21),
        )
        res = self.client.get(
            f"/api/reports/student-statement/?student_id={self.student.id}&month_shamsi=1404-02"
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["student"]["id"], self.student.id)
        self.assertEqual(res.data["through_month_shamsi"], "1404-02")
        self.assertEqual(res.data["months_count"], 2)
        self.assertEqual(res.data["summary"]["monthly_expected"], "2000.00")
        self.assertEqual(res.data["summary"]["monthly_paid"], "50.00")
        self.assertEqual(res.data["summary"]["monthly_due"], "1950.00")
        self.assertEqual(res.data["summary"]["transport_expected"], "400.00")
        self.assertEqual(res.data["summary"]["transport_paid"], "20.00")
        self.assertEqual(res.data["summary"]["transport_due"], "380.00")
        self.assertEqual(res.data["summary"]["uniform_expected"], "150.00")
        self.assertEqual(res.data["summary"]["uniform_paid"], "150.00")
        self.assertEqual(res.data["summary"]["uniform_due"], "0.00")
        self.assertEqual(res.data["summary"]["book_expected"], "100.00")
        self.assertEqual(res.data["summary"]["book_paid"], "0.00")
        self.assertEqual(res.data["summary"]["book_due"], "100.00")
        self.assertEqual(res.data["summary"]["previous_balance_expected"], "300.00")
        self.assertEqual(res.data["summary"]["previous_balance_paid"], "100.00")
        self.assertEqual(res.data["summary"]["previous_balance_due"], "200.00")
        self.assertEqual(res.data["summary"]["total_paid"], "320.00")
        self.assertEqual(res.data["summary"]["total_due"], "2630.00")
        self.assertEqual(len(res.data["payments"]), 4)
        self.assertEqual(res.data["months"][0]["month_shamsi"], "1404-01")
        self.assertEqual(res.data["months"][0]["due_monthly_fee"], "950.00")
        self.assertEqual(res.data["months"][0]["due_transport_fee"], "180.00")

    def test_teacher_statement_report(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        teacher = Teacher.objects.create(
            name="Ustad Karim",
            father_name="Abdul",
            phone="700000333",
            email="karim@example.com",
            address="Street 1",
            salary=Decimal("5000.00"),
            department="Math",
            created_at=timezone.make_aware(jdatetime.datetime(1404, 1, 1, 10, 0, 0).togregorian()),
        )
        TeacherSalaryPayment.objects.create(
            teacher=teacher,
            amount=Decimal("5000.00"),
            date_shamsi=jdatetime.date(1404, 1, 28),
        )
        TeacherSalaryPayment.objects.create(
            teacher=teacher,
            amount=Decimal("4000.00"),
            date_shamsi=jdatetime.date(1404, 2, 28),
        )

        res = self.client.get(f"/api/reports/teacher-statement/?teacher_id={teacher.id}&month_shamsi=1404-02")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["teacher"]["id"], teacher.id)
        self.assertEqual(res.data["through_month_shamsi"], "1404-02")
        self.assertEqual(res.data["months_count"], 2)
        self.assertEqual(res.data["summary"]["total_expected"], "10000.00")
        self.assertEqual(res.data["summary"]["total_paid"], "9000.00")
        self.assertEqual(res.data["summary"]["total_balance"], "1000.00")
        self.assertEqual(res.data["summary"]["total_due"], "1000.00")
        self.assertEqual(len(res.data["salary_payments"]), 2)
        self.assertEqual(res.data["months"][0]["month_shamsi"], "1404-01")
        self.assertEqual(res.data["months"][0]["due_salary"], "0.00")

        capped = self.client.get(f"/api/reports/teacher-statement/?teacher_id={teacher.id}&month_shamsi=1404-10")
        self.assertEqual(capped.status_code, 200, capped.data)
        self.assertEqual(capped.data["through_month_shamsi"], "1404-09")
        self.assertEqual(capped.data["months_count"], 9)
        self.assertEqual(capped.data["summary"]["total_expected"], "45000.00")

    def test_teacher_statement_report_does_not_fabricate_months_after_salary_cutoff(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        teacher = Teacher.objects.create(
            name="Ustad Hamid",
            father_name="Rahim",
            phone="700000555",
            email="hamid@example.com",
            address="Street 3",
            salary=Decimal("6000.00"),
            department="History",
            created_at=timezone.make_aware(jdatetime.datetime(1404, 10, 1, 10, 0, 0).togregorian()),
        )

        res = self.client.get(f"/api/reports/teacher-statement/?teacher_id={teacher.id}&month_shamsi=1404-10")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["through_month_shamsi"], "1404-09")
        self.assertEqual(res.data["teacher"]["start_month_shamsi"], "1404-10")
        self.assertEqual(res.data["months_count"], 0)
        self.assertEqual(res.data["months"], [])
        self.assertEqual(res.data["summary"]["total_expected"], "0.00")
        self.assertEqual(res.data["summary"]["total_paid"], "0.00")
        self.assertEqual(res.data["summary"]["total_balance"], "0.00")

    def test_teacher_salary_payment_api(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        teacher = Teacher.objects.create(
            name="Ustad Latif",
            father_name="Noor",
            phone="700000444",
            email="latif@example.com",
            address="Street 2",
            salary=Decimal("4500.00"),
            department="Science",
        )
        res = self.client.post(
            "/api/teacher-salary-payments/",
            {
                "teacher": teacher.id,
                "date_shamsi": "1404-03-10",
                "amount": "4500.00",
                "notes": "March salary",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["teacher_name"], teacher.name)
        self.assertEqual(res.data["teacher_department"], teacher.department)
        self.assertEqual(res.data["month_shamsi"], "1404-03")
        self.assertEqual(res.data["amount"], "4500.00")

        blocked = self.client.post(
            "/api/teacher-salary-payments/",
            {
                "teacher": teacher.id,
                "date_shamsi": "1404-10-10",
                "amount": "4500.00",
                "notes": "Invalid late salary",
            },
            format="json",
        )
        self.assertEqual(blocked.status_code, 400, blocked.data)
        self.assertIn("date_shamsi", blocked.data)

    def test_expense_category_statement_report(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        category = ExpenseCategory.objects.create(name="Utilities")
        other_category = ExpenseCategory.objects.create(name="Supplies")
        Expense.objects.create(
            category=category,
            amount=Decimal("1200.00"),
            date_shamsi=jdatetime.date(1404, 1, 10),
            paid_by="Admin",
            description="Electricity",
        )
        Expense.objects.create(
            category=category,
            amount=Decimal("800.00"),
            date_shamsi=jdatetime.date(1404, 1, 18),
            paid_by="Admin",
            description="Water",
        )
        Expense.objects.create(
            category=other_category,
            amount=Decimal("999.00"),
            date_shamsi=jdatetime.date(1404, 1, 20),
            paid_by="Admin",
            description="Should not appear",
        )

        res = self.client.get(
            f"/api/reports/expense-statement/?category_id={category.id}&start=1404-01-01&end=1404-01-30"
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["category"]["id"], category.id)
        self.assertEqual(res.data["summary"]["total_amount"], "2000.00")
        self.assertEqual(res.data["summary"]["expenses_count"], 2)
        self.assertEqual(len(res.data["expenses"]), 2)
        self.assertEqual(res.data["expenses"][0]["description"], "Electricity")
        self.assertEqual(res.data["expenses"][1]["description"], "Water")


class BackupFixtureRepairTests(TestCase):
    def test_repairs_dumpdata_jalali_year_bug(self):
        rows = [
            {
                "model": "core.payment",
                "pk": 1,
                "fields": {
                    "date_shamsi": "783-08-25",
                    "month_shamsi": "1404-11",
                },
            },
            {
                "model": "core.expense",
                "pk": 1,
                "fields": {"date_shamsi": "784-08-21"},
            },
        ]
        repair_backup_fixture_shamsi_dates(rows)
        self.assertEqual(rows[0]["fields"]["date_shamsi"], "1404-11-25")
        self.assertEqual(rows[1]["fields"]["date_shamsi"], "1405-08-21")

    def test_leaves_valid_shamsi_unchanged(self):
        rows = [
            {
                "model": "core.payment",
                "pk": 1,
                "fields": {"date_shamsi": "1404-08-25", "month_shamsi": "1404-11"},
            }
        ]
        repair_backup_fixture_shamsi_dates(rows)
        self.assertEqual(rows[0]["fields"]["date_shamsi"], "1404-08-25")


class BackupExportTests(APITestCase):
    def test_backup_export_requires_auth(self):
        res = self.client.get("/api/backup/export/")
        self.assertEqual(res.status_code, 401)

    def test_backup_export_returns_dumpdata_json_array(self):
        user = User.objects.create_user(username="b", password="b")
        self.client.force_authenticate(user=user)
        res = self.client.get("/api/backup/export/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("application/json", res["Content-Type"])
        data = json.loads(res.content.decode("utf-8"))
        self.assertIsInstance(data, list)
        user_rows = [row for row in data if row.get("model") == "auth.user"]
        self.assertTrue(any(row.get("fields", {}).get("username") == "b" for row in user_rows))


class PaymentAllocationTests(TestCase):
    def setUp(self):
        self.school_class = SchoolClass.objects.create(
            name="3rd A Morning",
            year_shamsi="1405",
            monthly_fee=Decimal("800.00"),
            transport_fee=Decimal("500.00"),
            uniform_fee=Decimal("0.00"),
            book_fee=Decimal("800.00"),
        )
        self.monthly_fee_type, _ = FeeType.objects.get_or_create(name="Monthly", defaults={"requires_reason": False})
        self.transport_fee_type, _ = FeeType.objects.get_or_create(name="Transport", defaults={"requires_reason": False})
        self.book_fee_type, _ = FeeType.objects.get_or_create(name="Book", defaults={"requires_reason": False})
        self.student = Student.objects.create(
            school_class=self.school_class,
            name="Abdulrahman",
            registration_number="390",
            father_name="Abdul Qadier",
            grandfather_name="x",
            phone="700000001",
            monthly_fee_override=Decimal("500.00"),
            transport_fee_override=Decimal("250.00"),
            book_fee_override=Decimal("400.00"),
            created_at=timezone.make_aware(jdatetime.datetime(1405, 1, 16, 10, 0, 0).togregorian()),
        )

    def test_lump_monthly_payment_splits_across_unpaid_months(self):
        from .serializers import PaymentSerializer

        serializer = PaymentSerializer(
            data={
                "student": self.student.id,
                "fee_type": self.monthly_fee_type.id,
                "amount": "1500.00",
                "date_shamsi": "1405-02-01",
                "bill_number": "1776753192215135",
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.assertEqual(Payment.objects.filter(student=self.student, fee_type=self.monthly_fee_type).count(), 3)
        months = list(
            Payment.objects.filter(student=self.student, fee_type=self.monthly_fee_type)
            .order_by("month_shamsi")
            .values_list("month_shamsi", "amount")
        )
        self.assertEqual(
            months,
            [("1405-01", Decimal("500.00")), ("1405-02", Decimal("500.00")), ("1405-03", Decimal("500.00"))],
        )

    def test_named_month_reason_allocates_to_that_month(self):
        from .serializers import PaymentSerializer

        for reason in ("Hamal", "Sawar", "Jawza"):
            serializer = PaymentSerializer(
                data={
                    "student": self.student.id,
                    "fee_type": self.monthly_fee_type.id,
                    "amount": "500.00",
                    "date_shamsi": "1405-02-01",
                    "other_reason": reason,
                    "bill_number": "1776753192215136",
                }
            )
            self.assertTrue(serializer.is_valid(), serializer.errors)
            serializer.save()
        months = list(
            Payment.objects.filter(student=self.student, fee_type=self.monthly_fee_type)
            .order_by("month_shamsi")
            .values_list("month_shamsi", flat=True)
        )
        self.assertEqual(months, ["1405-01", "1405-02", "1405-03"])

    def test_fix_payment_months_command_rewrites_legacy_rows(self):
        Payment.objects.create(
            student=self.student,
            fee_type=self.monthly_fee_type,
            amount=Decimal("500.00"),
            date_shamsi=jdatetime.date(1405, 2, 1),
            month_shamsi="1405-02",
            other_reason="Hamal",
            bill_number="1776753192215137",
        )
        Payment.objects.create(
            student=self.student,
            fee_type=self.monthly_fee_type,
            amount=Decimal("500.00"),
            date_shamsi=jdatetime.date(1405, 2, 1),
            month_shamsi="1405-02",
            other_reason="Sawar",
            bill_number="1776753192215137",
        )
        Payment.objects.create(
            student=self.student,
            fee_type=self.monthly_fee_type,
            amount=Decimal("500.00"),
            date_shamsi=jdatetime.date(1405, 2, 1),
            month_shamsi="1405-02",
            other_reason="Jawza",
            bill_number="1776753192215137",
        )

        from django.core.management import call_command

        call_command("fix_payment_months", registration_number="390")
        months = list(
            Payment.objects.filter(student=self.student, fee_type=self.monthly_fee_type)
            .order_by("month_shamsi")
            .values_list("month_shamsi", flat=True)
        )
        self.assertEqual(months, ["1405-01", "1405-02", "1405-03"])

    def test_book_payment_is_not_reallocated(self):
        Payment.objects.create(
            student=self.student,
            fee_type=self.book_fee_type,
            amount=Decimal("400.00"),
            date_shamsi=jdatetime.date(1405, 2, 1),
            bill_number="1776753192215138",
        )
        self.assertEqual(Payment.objects.filter(student=self.student, fee_type=self.book_fee_type).count(), 1)
        payment = Payment.objects.get(student=self.student, fee_type=self.book_fee_type)
        self.assertEqual(payment.month_shamsi, "1405-02")
