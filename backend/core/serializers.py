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
    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ["month_shamsi"]

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
    class Meta:
        model = Expense
        fields = "__all__"
