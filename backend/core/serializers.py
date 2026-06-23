from django.utils import timezone
from django_jalali.serializers.serializerfield import JDateField
from rest_framework import serializers

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

    def create(self, validated_data):
        if not validated_data.get("bill_number"):
            validated_data["bill_number"] = timezone.now().strftime("%y%m%d%H%M%S%f")[:16]
        if validated_data.get("student") and not validated_data.get("school_class"):
            validated_data["school_class"] = validated_data["student"].school_class
        return super().create(validated_data)


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
