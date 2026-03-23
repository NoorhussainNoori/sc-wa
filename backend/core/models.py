from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django_jalali.db import models as jmodels


digits_only_validator = RegexValidator(
    regex=r"^\d+$",
    message="Only numeric digits are allowed.",
)


class Student(models.Model):
    school_class = models.ForeignKey(
        "SchoolClass",
        on_delete=models.PROTECT,
        related_name="students",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=120)
    registration_number = models.CharField(max_length=50, unique=True)
    father_name = models.CharField(max_length=120)
    grandfather_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=30, validators=[digits_only_validator])
    monthly_fee_override = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        null=True,
        blank=True,
    )
    transport_fee_override = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        null=True,
        blank=True,
    )
    uniform_fee_override = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        null=True,
        blank=True,
    )
    book_fee_override = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["registration_number"]),
            models.Index(fields=["father_name"]),
            models.Index(fields=["grandfather_name"]),
            models.Index(fields=["phone"]),
        ]

    def __str__(self) -> str:
        # NOTE: `bill_number` was removed from Student (it lives on Payment now).
        return f"{self.name} ({self.father_name})"


class SchoolClass(models.Model):
    name = models.CharField(max_length=60)
    year_shamsi = models.CharField(max_length=4, validators=[RegexValidator(regex=r"^\d{4}$", message="Year must be YYYY.")])
    monthly_fee = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    transport_fee = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    uniform_fee = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    book_fee = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ("name", "year_shamsi")
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["year_shamsi"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.year_shamsi})"


class Teacher(models.Model):
    name = models.CharField(max_length=120)
    father_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=30, validators=[digits_only_validator])
    email = models.EmailField()
    address = models.CharField(max_length=255)
    salary = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    department = models.CharField(max_length=120)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self) -> str:
        return f"{self.name} - {self.department}"


class FeeType(models.Model):
    name = models.CharField(max_length=60, unique=True)
    requires_reason = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class Payment(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="payments")
    school_class = models.ForeignKey(
        "SchoolClass",
        on_delete=models.PROTECT,
        related_name="payments",
        null=True,
        blank=True,
    )
    fee_type = models.ForeignKey(FeeType, on_delete=models.PROTECT, related_name="payments")
    bill_number = models.CharField(
        max_length=30,
        validators=[digits_only_validator],
        blank=True,
        default="",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    date_shamsi = jmodels.jDateField()
    month_shamsi = models.CharField(max_length=7, blank=True)
    other_reason = models.CharField(max_length=255, blank=True)
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    def clean(self):
        if self.fee_type and self.fee_type.requires_reason and not self.other_reason:
            raise ValidationError({"other_reason": "This field is required for the selected fee type."})

    def save(self, *args, **kwargs):
        if not self.bill_number:
            self.bill_number = timezone.now().strftime("%y%m%d%H%M%S%f")[:16]
        if self.date_shamsi:
            self.month_shamsi = f"{self.date_shamsi.year:04d}-{self.date_shamsi.month:02d}"
        if self.student and not self.school_class:
            self.school_class = self.student.school_class
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.student} - {self.fee_type} - {self.amount}"


class ExpenseCategory(models.Model):
    name = models.CharField(max_length=60, unique=True)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class Expense(models.Model):
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name="expenses")
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    date_shamsi = jmodels.jDateField()
    paid_by = models.CharField(max_length=120)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self) -> str:
        return f"{self.category} - {self.amount}"

# Create your models here.
