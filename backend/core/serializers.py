from rest_framework import serializers

from .models import (
    Student,
    Teacher,
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


class FeeTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeType
        fields = "__all__"


class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    fee_type_name = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    class_year_shamsi = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ["month_shamsi"]

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
        if validated_data.get("student") and not validated_data.get("school_class"):
            validated_data["school_class"] = validated_data["student"].school_class
        return super().create(validated_data)


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = "__all__"


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = "__all__"

    def get_category_name(self, obj):
        return getattr(obj.category, "name", "") if obj.category_id else ""
