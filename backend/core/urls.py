from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    StudentViewSet,
    TeacherViewSet,
    SchoolClassViewSet,
    FeeTypeViewSet,
    PaymentViewSet,
    ExpenseCategoryViewSet,
    ExpenseViewSet,
    ReportSummaryView,
)

router = DefaultRouter()
router.register(r"students", StudentViewSet)
router.register(r"teachers", TeacherViewSet)
router.register(r"classes", SchoolClassViewSet)
router.register(r"fee-types", FeeTypeViewSet)
router.register(r"payments", PaymentViewSet)
router.register(r"expense-categories", ExpenseCategoryViewSet)
router.register(r"expenses", ExpenseViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("reports/summary/", ReportSummaryView.as_view(), name="report-summary"),
]
