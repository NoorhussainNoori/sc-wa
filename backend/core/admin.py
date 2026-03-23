from django.contrib import admin

from .models import (
    Student,
    Teacher,
    SchoolClass,
    FeeType,
    Payment,
    ExpenseCategory,
    Expense,
)

admin.site.register(Student)
admin.site.register(Teacher)
admin.site.register(SchoolClass)
admin.site.register(FeeType)
admin.site.register(Payment)
admin.site.register(ExpenseCategory)
admin.site.register(Expense)

# Register your models here.
