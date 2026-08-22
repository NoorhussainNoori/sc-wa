from django.db import transaction
from django.utils import timezone
from django_jalali.serializers.serializerfield import JDateField
from rest_framework import serializers

from .payment_allocation import (
    PaymentEvent,
    fee_category,
    fee_types_for_category,
    is_allocatable_fee_type,
    payment_to_event,
    replay_events,
    replace_student_category_payments,
)
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


class StudentSerializer(serializers.ModelSerializer):
    def create(self, validated_data):
        if validated_data.get("is_active") is False and not validated_data.get("deactivated_at"):
            validated_data["deactivated_at"] = timezone.now()
        return super().create(validated_data)

    def update(self, instance, validated_data):
        next_is_active = validated_data.get("is_active", instance.is_active)
        if instance.is_active and not next_is_active:
            validated_data["deactivated_at"] = timezone.now()
        elif not instance.is_active and next_is_active:
            validated_data["deactivated_at"] = None
        return super().update(instance, validated_data)

    class Meta:
        model = Student
        fields = "__all__"


class SchoolClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolClass
        fields = "__all__"


class TeacherSerializer(serializers.ModelSerializer):
    class Meta:
        model = Teacher
        fields = "__all__"


class TeacherSalaryPaymentSerializer(serializers.ModelSerializer):
    date_shamsi = JDateField()
    teacher_name = serializers.SerializerMethodField()
    teacher_department = serializers.SerializerMethodField()

    class Meta:
        model = TeacherSalaryPayment
        fields = "__all__"
        read_only_fields = ["month_shamsi"]

    def get_teacher_name(self, obj):
        return getattr(obj.teacher, "name", "") if obj.teacher_id else ""

    def get_teacher_department(self, obj):
        return getattr(obj.teacher, "department", "") if obj.teacher_id else ""

    def validate(self, attrs):
        date_shamsi = attrs.get("date_shamsi")
        if date_shamsi and date_shamsi.month > 9:
            raise serializers.ValidationError(
                {"date_shamsi": "Teacher salary payments are only allowed up to Shamsi month 09."}
            )
        return attrs


class FeeTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeType
        fields = "__all__"


class PaymentSerializer(serializers.ModelSerializer):
    # DRF's DateField parses YYYY-MM-DD as Gregorian; Shamsi years like 1404 must use Jalali parsing.
    date_shamsi = JDateField()
    student_name = serializers.SerializerMethodField()
    fee_type_name = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    class_year_shamsi = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ["month_shamsi"]
        extra_kwargs = {
            "bill_number": {"required": False, "allow_blank": True},
        }

    def get_student_name(self, obj):
        return getattr(obj.student, "name", "") if obj.student_id else ""

    def get_fee_type_name(self, obj):
        return getattr(obj.fee_type, "name", "") if obj.fee_type_id else ""

    def get_class_name(self, obj):
        return getattr(obj.school_class, "name", "") if obj.school_class_id else ""

    def get_class_year_shamsi(self, obj):
        return getattr(obj.school_class, "year_shamsi", "") if obj.school_class_id else ""

    def validate(self, attrs):
        fee_type = attrs.get("fee_type")
        other_reason = attrs.get("other_reason")
        if fee_type and fee_type.requires_reason and not other_reason:
            raise serializers.ValidationError(
                {"other_reason": "This field is required for the selected fee type."}
            )
        return attrs

    def _event_from_validated(self, validated_data, *, source_id=None):
        fee_type = validated_data["fee_type"]
        school_class = validated_data.get("school_class")
        return PaymentEvent(
            amount=validated_data["amount"],
            date_shamsi=validated_data["date_shamsi"],
            bill_number=validated_data.get("bill_number") or "",
            notes=validated_data.get("notes") or "",
            other_reason=validated_data.get("other_reason") or "",
            fee_type_id=fee_type.id,
            school_class_id=school_class.id if school_class else None,
            created_at=timezone.now(),
            source_id=source_id,
        )

    def _replay_allocatable_payment(self, student, fee_type, events):
        category = fee_category(fee_type.name)
        if not category:
            return None
        target_rows = replay_events(student, category, events)
        replace_student_category_payments(student, category, target_rows)
        return category

    def _find_created_payment(self, student, fee_type, bill_number):
        return (
            Payment.objects.filter(student=student, fee_type=fee_type, bill_number=bill_number)
            .order_by("id")
            .first()
        )

    @transaction.atomic
    def create(self, validated_data):
        if not validated_data.get("bill_number"):
            validated_data["bill_number"] = timezone.now().strftime("%y%m%d%H%M%S%f")[:16]
        if validated_data.get("student") and not validated_data.get("school_class"):
            validated_data["school_class"] = validated_data["student"].school_class

        fee_type = validated_data["fee_type"]
        student = validated_data["student"]
        if is_allocatable_fee_type(fee_type):
            category = fee_category(fee_type.name)
            existing = Payment.objects.filter(
                student=student,
                fee_type__in=fee_types_for_category(category),
            ).order_by("date_shamsi", "created_at", "id")
            events = [payment_to_event(payment) for payment in existing]
            events.append(self._event_from_validated(validated_data))
            self._replay_allocatable_payment(student, fee_type, events)
            return self._find_created_payment(student, fee_type, validated_data["bill_number"])

        return super().create(validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        fee_type = validated_data.get("fee_type", instance.fee_type)
        student = validated_data.get("student", instance.student)
        if not is_allocatable_fee_type(fee_type):
            return super().update(instance, validated_data)

        merged = {
            "fee_type": fee_type,
            "student": student,
            "school_class": validated_data.get("school_class", instance.school_class),
            "amount": validated_data.get("amount", instance.amount),
            "date_shamsi": validated_data.get("date_shamsi", instance.date_shamsi),
            "bill_number": validated_data.get("bill_number", instance.bill_number),
            "notes": validated_data.get("notes", instance.notes),
            "other_reason": validated_data.get("other_reason", instance.other_reason),
        }
        category = fee_category(fee_type.name)
        existing = Payment.objects.filter(
            student=student,
            fee_type__in=fee_types_for_category(category),
        ).order_by("date_shamsi", "created_at", "id")
        events = []
        for payment in existing:
            if payment.id == instance.id:
                events.append(self._event_from_validated(merged, source_id=payment.id))
            else:
                events.append(payment_to_event(payment))

        self._replay_allocatable_payment(student, fee_type, events)
        if Payment.objects.filter(pk=instance.pk).exists():
            instance.refresh_from_db()
            return instance
        return self._find_created_payment(student, fee_type, merged["bill_number"]) or instance


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = "__all__"


class ExpenseSerializer(serializers.ModelSerializer):
    date_shamsi = JDateField()
    category_name = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = "__all__"

    def get_category_name(self, obj):
        return getattr(obj.category, "name", "") if obj.category_id else ""
