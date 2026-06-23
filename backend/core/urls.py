from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    StudentViewSet,
    TeacherViewSet,
    TeacherSalaryPaymentViewSet,
    SchoolClassViewSet,
    FeeTypeViewSet,
    PaymentViewSet,
    ExpenseCategoryViewSet,
    ExpenseViewSet,
    ReportSummaryView,
    MonthlyDueFeesView,
    ClassMonthlyFeesReportView,
    TeacherStatementReportView,
    StudentStatementReportView,
    BackupExportView,
    BackupRestoreView,
)

router = DefaultRouter()
router.register(r"students", StudentViewSet)
router.register(r"teachers", TeacherViewSet)
router.register(r"teacher-salary-payments", TeacherSalaryPaymentViewSet)
router.register(r"classes", SchoolClassViewSet)
router.register(r"fee-types", FeeTypeViewSet)
router.register(r"payments", PaymentViewSet)
router.register(r"expense-categories", ExpenseCategoryViewSet)
router.register(r"expenses", ExpenseViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("reports/summary/", ReportSummaryView.as_view(), name="report-summary"),
    path("reports/monthly-dues/", MonthlyDueFeesView.as_view(), name="report-monthly-dues"),
    path(
        "reports/class-monthly-fees/",
        ClassMonthlyFeesReportView.as_view(),
        name="report-class-monthly-fees",
    ),
    path(
        "reports/teacher-statement/",
        TeacherStatementReportView.as_view(),
        name="report-teacher-statement",
    ),
    path(
        "reports/student-statement/",
        StudentStatementReportView.as_view(),
        name="report-student-statement",
    ),
    path("backup/export/", BackupExportView.as_view(), name="backup-export"),
    path("backup/restore/", BackupRestoreView.as_view(), name="backup-restore"),
]
