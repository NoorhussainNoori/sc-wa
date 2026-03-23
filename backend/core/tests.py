from decimal import Decimal

import jdatetime
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.models import Sum
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

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
        expected = self.school_class.monthly_fee
        due_expected = expected - self.payment.amount
        self.assertEqual(first["due_amount"], str(due_expected))
