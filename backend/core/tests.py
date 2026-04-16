import json
from decimal import Decimal

import jdatetime
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.models import Sum
from rest_framework.authtoken.models import Token
from django.test import TestCase
from rest_framework.test import APITestCase

from .backup_fixture import repair_backup_fixture_shamsi_dates
from .models import FeeType, Payment, SchoolClass, Student


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
        total_due = due_monthly_current + due_transport_current
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
        self.assertEqual(first["due_amount"], str(total_due))
        self.assertEqual(first["due_monthly_previous_months_count"], 0)
        self.assertEqual(first["due_transport_previous_months_count"], 0)
        self.assertEqual(res.data["dues_from_month_shamsi"], "1404-01")
        self.assertEqual(res.data["months_count"], 1)

    def test_monthly_dues_report_cumulative_hamal_through_selected(self):
        """Baqiāt = sum of per-month shortfalls from 1404-01 through selected month."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
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
        self.assertEqual(first["due_amount"], "2350.00")
        self.assertEqual(first["due_monthly_previous_months_count"], 1)
        self.assertEqual(first["due_transport_previous_months_count"], 1)
        self.assertEqual(res.data["dues_from_month_shamsi"], "1404-01")
        self.assertEqual(res.data["months_count"], 2)

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
