import { Fragment, useState } from "react";
import { apiFetch, extractListData, extractPaginationMeta } from "../api.js";
import Field from "../components/Field.jsx";
import PaginationControls from "../components/PaginationControls.jsx";
import StatCard from "../components/StatCard.jsx";

const defaultFilters = {
  period: "month",
  date: "",
  start: "",
  end: "",
  includeItems: true,
};

const studentSearchPageSize = 8;
const teacherSearchPageSize = 8;

export default function Reports() {
  const RECEIPT_TEMPLATE_KEY = "receipt_template_config_v1";
  const defaultTemplate = {
    schoolName: "Watan Oxford High School",
    schoolAddress: "School Address (Update Later)",
    schoolPhone: "0700 000 000",
    thankYouMessage: "Thank you for your attention and timely payment.",
    logoDataUrl: "",
    dariBillTitle: "Ù„ÛŒØ³Ù‡ Ø®ØµÙˆØµÛŒ ÙˆØ·Ù† Ø¢Ú©Ø³ÙÙˆØ±\u0689 ÙÛŒØ³ Ø¨Ù„",
    englishFeesBillLine: "Watan Oxford High School FeesBill",
    dariBillFooterNote:
      "ÛŒØ§Ø¯Ø§Ø´Øª: ÙˆØ§Ù„Ø¯ÛŒÙ† Ú¯Ø±Ø§Ù…ÛŒ Ø¯Ø± ØªØ­ÙˆÛŒÙ„ÛŒ ÙÛŒØ³ ÙØ±Ø²Ù†Ø¯Ø§Ù† ØªØ§Ù† Ú©ÙˆØ´Ø´ Ù†Ù…Ø§ÛŒØ¯ ØªØ§ Ø¯Ø± ÙˆÙ‚Øª Ù…Ø¹ÛŒÙ† ÙÛŒØ³ Ù…Ø°Ú©ÙˆØ± Ø±Ø§ ØªØ§Ø¯ÛŒÙ‡ Ù†Ù…ÙˆØ¯Ù‡ ØªØ§ Ù‡Ù…Ú©Ø§Ø± Ø¨Ø§ Ø¢Ø¯Ø§Ø±Ù‡ Ù„ÛŒØ³Ù‡ Ø¯Ø± Ø²Ù…ÛŒÙ†Ù‡ Ù…Ø¹Ø§Ø´Ø§Øª Ø§Ø³ØªØ§Ø¯Ø§Ù† Ø¨Ø§Ø´ÛŒØ¯.",
  };
  const [filters, setFilters] = useState(defaultFilters);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loadingReport, setLoadingReport] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [classMonthShamsi, setClassMonthShamsi] = useState("");
  const [classMonthReport, setClassMonthReport] = useState(null);
  const [classMonthError, setClassMonthError] = useState("");
  const [loadingClassMonth, setLoadingClassMonth] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsMeta, setStudentsMeta] = useState({
    count: 0,
    next: null,
    previous: null,
  });
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentStatementMonth, setStudentStatementMonth] = useState("");
  const [studentStatement, setStudentStatement] = useState(null);
  const [studentStatementError, setStudentStatementError] = useState("");
  const [loadingStudentSearch, setLoadingStudentSearch] = useState(false);
  const [loadingStudentStatement, setLoadingStudentStatement] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [teachersPage, setTeachersPage] = useState(1);
  const [teachersMeta, setTeachersMeta] = useState({
    count: 0,
    next: null,
    previous: null,
  });
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherStatementMonth, setTeacherStatementMonth] = useState("");
  const [teacherStatement, setTeacherStatement] = useState(null);
  const [teacherStatementError, setTeacherStatementError] = useState("");
  const [loadingTeacherSearch, setLoadingTeacherSearch] = useState(false);
  const [loadingTeacherStatement, setLoadingTeacherStatement] = useState(false);
  const [teacherSalaryYear, setTeacherSalaryYear] = useState("");
  const [teacherSalaryList, setTeacherSalaryList] = useState(null);
  const [teacherSalaryError, setTeacherSalaryError] = useState("");
  const [loadingTeacherSalaryList, setLoadingTeacherSalaryList] = useState(false);
  const [exportingTeacherSalaryExcel, setExportingTeacherSalaryExcel] = useState(false);
  const [studentPaymentYear, setStudentPaymentYear] = useState("");
  const [studentPaymentClassId, setStudentPaymentClassId] = useState("");
  const [studentPaymentCategories, setStudentPaymentCategories] = useState({
    monthly: true,
    transport: true,
    uniform: true,
    book: true,
  });
  const [studentPaymentList, setStudentPaymentList] = useState(null);
  const [studentPaymentError, setStudentPaymentError] = useState("");
  const [loadingStudentPaymentList, setLoadingStudentPaymentList] = useState(false);
  const [exportingStudentPaymentExcel, setExportingStudentPaymentExcel] = useState(false);
  const [studentPaymentStatusOnly, setStudentPaymentStatusOnly] = useState(false);
  const [reportClasses, setReportClasses] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [selectedExpenseCategoryId, setSelectedExpenseCategoryId] = useState("");
  const [expenseStatementStart, setExpenseStatementStart] = useState("");
  const [expenseStatementEnd, setExpenseStatementEnd] = useState("");
  const [expenseStatement, setExpenseStatement] = useState(null);
  const [expenseStatementError, setExpenseStatementError] = useState("");
  const [loadingExpenseStatement, setLoadingExpenseStatement] = useState(false);
  const [exportingExpenseExcel, setExportingExpenseExcel] = useState(false);

  const classFeesGridStyle = {
    gridTemplateColumns: "minmax(160px, 1.5fr) 70px repeat(8, minmax(88px, 1fr)) 56px",
    minWidth: "1120px",
  };

  const moneySum = (...values) =>
    values.reduce((acc, value) => acc + (Number(value) || 0), 0).toFixed(2);

  const isStudentCategoryPaid = (month, categoryKey) => {
    const amount = month?.amounts?.[categoryKey];
    if (amount != null && amount !== "") return Number(amount) > 0;
    const display = month?.displays?.[categoryKey];
    return Boolean(display && display !== "//");
  };

  const studentPaymentCellValue = (month, categoryKey) => {
    if (studentPaymentStatusOnly) {
      return isStudentCategoryPaid(month, categoryKey) ? "✓" : "✗";
    }
    return month?.displays?.[categoryKey] || "//";
  };

  const classMonthTotals = (() => {
    const rows = classMonthReport?.classes || [];
    return {
      student_count: rows.reduce((acc, row) => acc + (Number(row.student_count) || 0), 0),
      total_monthly_expected: moneySum(...rows.map((row) => row.total_monthly_expected)),
      total_monthly_paid: moneySum(...rows.map((row) => row.total_monthly_paid)),
      total_uniform_expected: moneySum(...rows.map((row) => row.total_uniform_expected)),
      total_uniform_paid: moneySum(...rows.map((row) => row.total_uniform_paid)),
      total_transport_expected: moneySum(...rows.map((row) => row.total_transport_expected)),
      total_transport_paid: moneySum(...rows.map((row) => row.total_transport_paid)),
      total_expected: moneySum(...rows.map((row) => row.total_expected)),
      total_paid: moneySum(...rows.map((row) => row.total_paid)),
      free_students_count: rows.reduce((acc, row) => acc + (Number(row.free_students_count) || 0), 0),
    };
  })();
  const [templateStatus, setTemplateStatus] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [template, setTemplate] = useState(() => {
    try {
      const raw = localStorage.getItem(RECEIPT_TEMPLATE_KEY);
      if (!raw) return defaultTemplate;
      return { ...defaultTemplate, ...JSON.parse(raw) };
    } catch {
      return defaultTemplate;
    }
  });

  const onChange = (field) => (event) => {
    const value = field === "includeItems" ? event.target.checked : event.target.value;
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const fetchReport = async () => {
    setError("");
    setLoadingReport(true);
    try {
      const params = new URLSearchParams();
      params.set("period", filters.period);
      if (filters.includeItems) params.set("include_items", "1");
      if (filters.period === "custom") {
        if (filters.start) params.set("start", filters.start);
        if (filters.end) params.set("end", filters.end);
      } else if (filters.date) {
        params.set("date", filters.date);
      }
      const data = await apiFetch(`/reports/summary/?${params.toString()}`);
      setSummary(data);
    } catch (err) {
      setError(err.message || "Failed to load report.");
    } finally {
      setLoadingReport(false);
    }
  };

  const fetchClassMonthReport = async () => {
    setClassMonthError("");
    const m = String(classMonthShamsi || "").trim();
    if (!/^\d{4}-\d{2}$/.test(m)) {
      setClassMonthError("Enter Shamsi month as YYYY-MM (e.g. 1404-01).");
      return;
    }
    setLoadingClassMonth(true);
    try {
      const params = new URLSearchParams({ month_shamsi: m });
      const data = await apiFetch(`/reports/class-monthly-fees/?${params.toString()}`);
      setClassMonthReport(data);
    } catch (err) {
      setClassMonthError(err.message || "Failed to load class report.");
      setClassMonthReport(null);
    } finally {
      setLoadingClassMonth(false);
    }
  };

  const searchStudents = async (page = 1) => {
    setStudentStatementError("");
    setLoadingStudentSearch(true);
    try {
      const params = new URLSearchParams({
        q: studentSearch,
        include_inactive: "1",
        page: String(page),
        page_size: String(studentSearchPageSize),
      });
      const data = await apiFetch(`/students/?${params.toString()}`);
      setStudents(extractListData(data));
      setStudentsMeta(extractPaginationMeta(data));
      setStudentsPage(page);
    } catch (err) {
      setStudentStatementError(err.message || "Failed to search students.");
    } finally {
      setLoadingStudentSearch(false);
    }
  };

  const loadStudentStatement = async () => {
    if (!selectedStudent?.id) {
      setStudentStatementError("Select a student first.");
      return;
    }
    setStudentStatementError("");
    setLoadingStudentStatement(true);
    try {
      const params = new URLSearchParams({
        student_id: String(selectedStudent.id),
      });
      const month = String(studentStatementMonth || "").trim();
      if (month) params.set("month_shamsi", month);
      const data = await apiFetch(`/reports/student-statement/?${params.toString()}`);
      setStudentStatement(data);
    } catch (err) {
      setStudentStatementError(err.message || "Failed to load student statement.");
      setStudentStatement(null);
    } finally {
      setLoadingStudentStatement(false);
    }
  };

  const searchTeachers = async (page = 1) => {
    setTeacherStatementError("");
    setLoadingTeacherSearch(true);
    try {
      const params = new URLSearchParams({
        q: teacherSearch,
        page: String(page),
        page_size: String(teacherSearchPageSize),
      });
      const data = await apiFetch(`/teachers/?${params.toString()}`);
      setTeachers(extractListData(data));
      setTeachersMeta(extractPaginationMeta(data));
      setTeachersPage(page);
    } catch (err) {
      setTeacherStatementError(err.message || "Failed to search teachers.");
    } finally {
      setLoadingTeacherSearch(false);
    }
  };

  const loadTeacherStatement = async () => {
    if (!selectedTeacher?.id) {
      setTeacherStatementError("Select a teacher first.");
      return;
    }
    setTeacherStatementError("");
    setLoadingTeacherStatement(true);
    try {
      const params = new URLSearchParams({
        teacher_id: String(selectedTeacher.id),
      });
      const month = String(teacherStatementMonth || "").trim();
      if (month) params.set("month_shamsi", month);
      const data = await apiFetch(`/reports/teacher-statement/?${params.toString()}`);
      setTeacherStatement(data);
    } catch (err) {
      setTeacherStatementError(err.message || "Failed to load teacher statement.");
      setTeacherStatement(null);
    } finally {
      setLoadingTeacherStatement(false);
    }
  };

  const loadTeacherSalaryList = async () => {
    setTeacherSalaryError("");
    setLoadingTeacherSalaryList(true);
    try {
      const params = new URLSearchParams();
      const year = String(teacherSalaryYear || "").trim();
      if (year) params.set("year_shamsi", year);
      const query = params.toString();
      const data = await apiFetch(`/reports/teacher-salary-list/${query ? `?${query}` : ""}`);
      setTeacherSalaryList(data);
    } catch (err) {
      setTeacherSalaryError(err.message || "Failed to load teacher salary list.");
      setTeacherSalaryList(null);
    } finally {
      setLoadingTeacherSalaryList(false);
    }
  };

  const loadReportClasses = async () => {
    try {
      const data = await apiFetch("/classes/?page_size=200");
      setReportClasses(extractListData(data));
    } catch (err) {
      setStudentPaymentError(err.message || "Failed to load classes.");
    }
  };

  const loadStudentPaymentList = async () => {
    const selected = Object.entries(studentPaymentCategories)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key);
    if (!selected.length) {
      setStudentPaymentError("Select at least one fee category.");
      return;
    }
    setStudentPaymentError("");
    setLoadingStudentPaymentList(true);
    try {
      const params = new URLSearchParams();
      const year = String(studentPaymentYear || "").trim();
      if (year) params.set("year_shamsi", year);
      if (studentPaymentClassId) params.set("class_id", String(studentPaymentClassId));
      params.set("categories", selected.join(","));
      const data = await apiFetch(`/reports/student-payment-list/?${params.toString()}`);
      setStudentPaymentList(data);
    } catch (err) {
      setStudentPaymentError(err.message || "Failed to load student payment list.");
      setStudentPaymentList(null);
    } finally {
      setLoadingStudentPaymentList(false);
    }
  };

  const onSelectTeacher = (teacher) => {
    setSelectedTeacher(teacher);
  };

  const loadExpenseCategories = async () => {
    try {
      const data = await apiFetch("/expense-categories/?page_size=100");
      setExpenseCategories(extractListData(data));
    } catch (err) {
      setExpenseStatementError(err.message || "Failed to load expense categories.");
    }
  };

  const loadExpenseStatement = async () => {
    setExpenseStatementError("");
    setLoadingExpenseStatement(true);
    try {
      const params = new URLSearchParams();
      if (selectedExpenseCategoryId) {
        params.set("category_id", String(selectedExpenseCategoryId));
      }
      if (expenseStatementStart && expenseStatementEnd) {
        params.set("start", expenseStatementStart);
        params.set("end", expenseStatementEnd);
      } else if (expenseStatementStart || expenseStatementEnd) {
        setExpenseStatementError("Enter both start and end dates, or leave both blank.");
        setLoadingExpenseStatement(false);
        return;
      }
      const query = params.toString();
      const data = await apiFetch(`/reports/expense-statement/${query ? `?${query}` : ""}`);
      setExpenseStatement(data);
    } catch (err) {
      setExpenseStatementError(err.message || "Failed to load expense statement.");
      setExpenseStatement(null);
    } finally {
      setLoadingExpenseStatement(false);
    }
  };

  const exportClassMonthCsv = () => {
    if (!classMonthReport?.classes) return;
    const lines = [];
    lines.push(`School,${template.schoolName}`);
    lines.push("Report,Class monthly fees (one Shamsi month)");
    lines.push(`Month (Shamsi),${classMonthReport.month_shamsi}`);
    lines.push("");
    lines.push(
      [
        "Class",
        "Students",
        "Monthly fees",
        "Monthly paid",
        "Uniform fees",
        "Uniform paid",
        "Transport fees",
        "Transport paid",
        "Total fees",
        "Total paid",
        "Free students",
      ].join(",")
    );
    (classMonthReport.classes || []).forEach((row) => {
      lines.push(
        [
          `"${String(row.class_label || "").replaceAll('"', '""')}"`,
          row.student_count,
          row.total_monthly_expected,
          row.total_monthly_paid,
          row.total_uniform_expected,
          row.total_uniform_paid,
          row.total_transport_expected,
          row.total_transport_paid,
          row.total_expected,
          row.total_paid,
          row.free_students_count,
        ].join(",")
      );
    });
    lines.push(
      [
        "TOTAL",
        classMonthTotals.student_count,
        classMonthTotals.total_monthly_expected,
        classMonthTotals.total_monthly_paid,
        classMonthTotals.total_uniform_expected,
        classMonthTotals.total_uniform_paid,
        classMonthTotals.total_transport_expected,
        classMonthTotals.total_transport_paid,
        classMonthTotals.total_expected,
        classMonthTotals.total_paid,
        classMonthTotals.free_students_count,
      ].join(",")
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `class_monthly_fees_${classMonthReport.month_shamsi}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printClassMonthReport = () => {
    if (!classMonthReport?.classes) return;
    const reportWindow = window.open("", "_blank", "width=1400,height=900");
    if (!reportWindow) return;
    const headCells = [
      "Class",
      "Students",
      "Monthly fees",
      "Monthly paid",
      "Uniform fees",
      "Uniform paid",
      "Transport fees",
      "Transport paid",
      "Total fees",
      "Total paid",
      "Free",
    ];
    const headerRow = `<tr>${headCells.map((h) => `<th>${h}</th>`).join("")}</tr>`;
    const bodyRows = (classMonthReport.classes || [])
      .map(
        (r) => `
      <tr>
        <td>${String(r.class_label || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</td>
        <td>${r.student_count}</td>
        <td>${r.total_monthly_expected}</td>
        <td>${r.total_monthly_paid}</td>
        <td>${r.total_uniform_expected}</td>
        <td>${r.total_uniform_paid}</td>
        <td>${r.total_transport_expected}</td>
        <td>${r.total_transport_paid}</td>
        <td><strong>${r.total_expected}</strong></td>
        <td><strong>${r.total_paid}</strong></td>
        <td>${r.free_students_count}</td>
      </tr>`
      )
      .join("");
    const footerRow = `
      <tr class="total-row">
        <td>TOTAL</td>
        <td>${classMonthTotals.student_count}</td>
        <td>${classMonthTotals.total_monthly_expected}</td>
        <td>${classMonthTotals.total_monthly_paid}</td>
        <td>${classMonthTotals.total_uniform_expected}</td>
        <td>${classMonthTotals.total_uniform_paid}</td>
        <td>${classMonthTotals.total_transport_expected}</td>
        <td>${classMonthTotals.total_transport_paid}</td>
        <td>${classMonthTotals.total_expected}</td>
        <td>${classMonthTotals.total_paid}</td>
        <td>${classMonthTotals.free_students_count}</td>
      </tr>`;
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Class fees ${classMonthReport.month_shamsi}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            * { box-sizing: border-box; }
            body { font-family: "Segoe UI", Arial, sans-serif; padding: 12px; color: #0f172a; }
            h1 { font-size: 1.1rem; margin: 0 0 4px; }
            .muted { color: #64748b; font-size: 0.85rem; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 5px; vertical-align: middle; }
            th { background: #f1f5f9; text-align: left; font-size: 10px; }
            td:nth-child(n + 2) { text-align: right; }
            th:nth-child(n + 2) { text-align: right; }
            th:first-child, td:first-child { text-align: left; width: 16%; }
            .total-row { font-weight: 700; background: #e2e8f0; }
            .note { margin-top: 10px; font-size: 10px; color: #64748b; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>${String(template.schoolName || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</h1>
          <div class="muted">Class fees — Shamsi month ${classMonthReport.month_shamsi} (landscape)</div>
          <table>
            <thead>${headerRow}</thead>
            <tbody>${bodyRows}${footerRow}</tbody>
          </table>
          <p class="note">
            Monthly and transport are for this month only. Uniform is one-time (expected class/student fee, paid through this month).
            Total fees = monthly + uniform + transport. Total paid = all three paid amounts.
          </p>
        </body>
      </html>
    `;
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  const exportStudentStatementCsv = () => {
    if (!studentStatement) return;
    const lines = [];
    const student = studentStatement.student || {};
    const summary = studentStatement.summary || {};
    lines.push(`Student,${csvSafe(student.name)}`);
    lines.push(`Registration Number,${csvSafe(student.registration_number)}`);
    lines.push(`Class,${csvSafe(`${student.class_name || ""} (${student.class_year_shamsi || ""})`)}`);
    lines.push(`Enrolled,${csvSafe(student.enrolled_date_shamsi)}`);
    lines.push(`Through Month,${csvSafe(studentStatement.through_month_shamsi)}`);
    lines.push("");
    lines.push("Grand Summary");
    lines.push("Metric,Value");
    lines.push(`Total Should Pay,${csvSafe(summary.total_expected)}`);
    lines.push(`Total Paid,${csvSafe(summary.total_paid)}`);
    lines.push(`Balance,${csvSafe(summary.total_balance || summary.total_due)}`);
    lines.push("");
    lines.push("Fee Summary");
    lines.push("Metric,Value");
    lines.push(`Monthly Expected,${csvSafe(summary.monthly_expected)}`);
    lines.push(`Monthly Paid,${csvSafe(summary.monthly_paid)}`);
    lines.push(`Monthly Due,${csvSafe(summary.monthly_due)}`);
    lines.push(`Transport Expected,${csvSafe(summary.transport_expected)}`);
    lines.push(`Transport Paid,${csvSafe(summary.transport_paid)}`);
    lines.push(`Transport Due,${csvSafe(summary.transport_due)}`);
    lines.push(`Uniform Expected,${csvSafe(summary.uniform_expected)}`);
    lines.push(`Uniform Paid,${csvSafe(summary.uniform_paid)}`);
    lines.push(`Uniform Due,${csvSafe(summary.uniform_due)}`);
    lines.push(`Book Expected,${csvSafe(summary.book_expected)}`);
    lines.push(`Book Paid,${csvSafe(summary.book_paid)}`);
    lines.push(`Book Due,${csvSafe(summary.book_due)}`);
    lines.push(`Previous Balance Expected,${csvSafe(summary.previous_balance_expected)}`);
    lines.push(`Previous Balance Paid,${csvSafe(summary.previous_balance_paid)}`);
    lines.push(`Previous Balance Due,${csvSafe(summary.previous_balance_due)}`);
    lines.push(`Other Paid,${csvSafe(summary.other_paid)}`);
    lines.push(`Total Paid,${csvSafe(summary.total_paid)}`);
    lines.push(`Total Due,${csvSafe(summary.total_balance || summary.total_due)}`);
    lines.push("");
    lines.push("Monthly Breakdown");
    lines.push("Month,Expected Monthly,Paid Monthly,Due Monthly,Expected Transport,Paid Transport,Due Transport,Total Due");
    (studentStatement.months || []).forEach((row) => {
      lines.push(
        [
          csvSafe(row.month_shamsi),
          csvSafe(row.expected_monthly_fee),
          csvSafe(row.paid_monthly_fee),
          csvSafe(row.due_monthly_fee),
          csvSafe(row.expected_transport_fee),
          csvSafe(row.paid_transport_fee),
          csvSafe(row.due_transport_fee),
          csvSafe(row.total_due),
        ].join(",")
      );
    });
    lines.push("");
    lines.push("Payments");
    lines.push("ID,Bill,Fee Type,Amount,Date,Reason,Notes");
    (studentStatement.payments || []).forEach((item) => {
      lines.push(
        [
          item.id,
          csvSafe(item.bill_number),
          csvSafe(item.fee_type_name || item.fee_type),
          csvSafe(item.amount),
          csvSafe(item.date_shamsi),
          csvSafe(item.other_reason || ""),
          csvSafe(item.notes || ""),
        ].join(",")
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `student_statement_${student.registration_number || student.id}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printStudentStatement = () => {
    if (!studentStatement) return;
    const reportWindow = window.open("", "_blank", "width=1100,height=900");
    if (!reportWindow) return;
    const student = studentStatement.student || {};
    const summary = studentStatement.summary || {};
    const totalShouldPay = summary.total_expected || "0.00";
    const totalPaid = summary.total_paid || "0.00";
    const totalBalance = summary.total_balance || summary.total_due || "0.00";
    const monthRows = (studentStatement.months || [])
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.month_shamsi)}</td>
            <td>${escapeHtml(row.expected_monthly_fee)}</td>
            <td>${escapeHtml(row.paid_monthly_fee)}</td>
            <td>${escapeHtml(row.due_monthly_fee)}</td>
            <td>${escapeHtml(row.expected_transport_fee)}</td>
            <td>${escapeHtml(row.paid_transport_fee)}</td>
            <td>${escapeHtml(row.due_transport_fee)}</td>
            <td>${escapeHtml(row.total_due)}</td>
          </tr>
        `
      )
      .join("");
    const paymentRows = (studentStatement.payments || [])
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.bill_number)}</td>
            <td>${escapeHtml(item.fee_type_name || item.fee_type || "")}</td>
            <td style="text-align:right">${escapeHtml(item.amount)}</td>
            <td>${escapeHtml(item.date_shamsi)}</td>
            <td>${escapeHtml(item.other_reason || "")}</td>
            <td>${escapeHtml(item.notes || "")}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Student Statement</title>
          <style>
            body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; padding: 24px; }
            h1 { margin: 0; font-size: 1.4rem; }
            .muted { color: #64748b; font-size: 0.9rem; }
            .head { display:flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 16px; }
            .card-grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 16px 0; }
            .card { border:1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
            .card .label { color:#64748b; font-size: 0.8rem; }
            .card strong { display:block; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border:1px solid #e2e8f0; padding: 8px; vertical-align: top; }
            th { background:#f8fafc; text-align:left; }
            .section { margin-top: 20px; }
            .note { margin-top: 8px; color: #64748b; font-size: 11px; }
            .summary { display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0 18px; }
            .summary-card { border:1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; }
            .summary-card .label { color:#64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
            .summary-card .value { font-size: 16px; font-weight: 700; margin-top: 4px; }
            .info-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
            .info-item { border:1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
            .info-item .label { color:#64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
            .info-item .value { font-weight: 600; margin-top: 4px; }
            .signature { display:flex; justify-content: space-between; gap: 16px; margin-top: 44px; }
            .sig-box { width: 32%; border-top: 1px solid #0f172a; padding-top: 8px; min-height: 44px; font-size: 12px; }
            @media print { .no-print { display:none !important; } }
          </style>
        </head>
        <body>
          <div class="head">
            <div>
              <h1>Student Statement</h1>
              <div class="muted">${escapeHtml(student.name || "")} | ${escapeHtml(student.registration_number || "")}</div>
              <div class="muted">${escapeHtml(student.class_name || "")} (${escapeHtml(student.class_year_shamsi || "")})</div>
            </div>
            <div style="text-align:right">
              <div class="muted">Enrollment: ${escapeHtml(student.enrolled_date_shamsi || "")}</div>
              <div class="muted">Through: ${escapeHtml(studentStatement.through_month_shamsi || "")}</div>
              <div class="muted">Generated: ${escapeHtml(new Date().toLocaleString())}</div>
            </div>
          </div>

          <div class="summary">
            <div class="summary-card"><div class="label">Total Should Pay</div><div class="value">${escapeHtml(totalShouldPay)}</div></div>
            <div class="summary-card"><div class="label">Total Paid</div><div class="value">${escapeHtml(totalPaid)}</div></div>
            <div class="summary-card"><div class="label">Balance</div><div class="value">${escapeHtml(totalBalance)}</div></div>
            <div class="summary-card"><div class="label">Statement Through</div><div class="value">${escapeHtml(studentStatement.through_month_shamsi || "")}</div></div>
          </div>

          <div class="section">
            <h3>Student Information</h3>
            <div class="info-grid">
              <div class="info-item"><div class="label">Student</div><div class="value">${escapeHtml(student.name || "")}</div></div>
              <div class="info-item"><div class="label">Registration No</div><div class="value">${escapeHtml(student.registration_number || "")}</div></div>
              <div class="info-item"><div class="label">Father Name</div><div class="value">${escapeHtml(student.father_name || "")}</div></div>
              <div class="info-item"><div class="label">Class</div><div class="value">${escapeHtml(student.class_name || "")} (${escapeHtml(student.class_year_shamsi || "")})</div></div>
            </div>
            <div class="note">This statement combines recurring monthly charges with one-time item charges and recorded payments.</div>
          </div>

          <div class="section">
            <h3>Fee Summary</h3>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Expected</th>
                  <th>Paid</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Monthly</td><td>${escapeHtml(summary.monthly_expected || "0.00")}</td><td>${escapeHtml(summary.monthly_paid || "0.00")}</td><td>${escapeHtml(summary.monthly_due || "0.00")}</td></tr>
                <tr><td>Transport</td><td>${escapeHtml(summary.transport_expected || "0.00")}</td><td>${escapeHtml(summary.transport_paid || "0.00")}</td><td>${escapeHtml(summary.transport_due || "0.00")}</td></tr>
                <tr><td>Uniform</td><td>${escapeHtml(summary.uniform_expected || "0.00")}</td><td>${escapeHtml(summary.uniform_paid || "0.00")}</td><td>${escapeHtml(summary.uniform_due || "0.00")}</td></tr>
                <tr><td>Book</td><td>${escapeHtml(summary.book_expected || "0.00")}</td><td>${escapeHtml(summary.book_paid || "0.00")}</td><td>${escapeHtml(summary.book_due || "0.00")}</td></tr>
                <tr><td>Previous Balance</td><td>${escapeHtml(summary.previous_balance_expected || "0.00")}</td><td>${escapeHtml(summary.previous_balance_paid || "0.00")}</td><td>${escapeHtml(summary.previous_balance_due || "0.00")}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <h3>Monthly Breakdown</h3>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Expected Monthly</th>
                  <th>Paid Monthly</th>
                  <th>Due Monthly</th>
                  <th>Expected Transport</th>
                  <th>Paid Transport</th>
                  <th>Due Transport</th>
                  <th>Total Due</th>
                </tr>
              </thead>
              <tbody>${monthRows || '<tr><td colspan="8">No recurring fee rows.</td></tr>'}</tbody>
            </table>
          </div>

          <div class="section">
            <h3>Payment Ledger</h3>
            <table>
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Fee Type</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Reason</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>${paymentRows || '<tr><td colspan="6">No payments found.</td></tr>'}</tbody>
            </table>
          </div>

          <div class="signature">
            <div class="sig-box">Student / Guardian Signature</div>
            <div class="sig-box">Received By</div>
            <div class="sig-box">Authorized Signature and Stamp</div>
          </div>
        </body>
      </html>
    `;
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  const exportTeacherStatementCsv = () => {
    if (!teacherStatement) return;
    const lines = [];
    const teacher = teacherStatement.teacher || {};
    const summary = teacherStatement.summary || {};
    lines.push(`Teacher,${csvSafe(teacher.name)}`);
    lines.push(`Department,${csvSafe(teacher.department)}`);
    lines.push(`Salary,${csvSafe(teacher.salary)}`);
    lines.push(`Through Month,${csvSafe(teacherStatement.through_month_shamsi)}`);
    lines.push("");
    lines.push("Grand Summary");
    lines.push("Metric,Value");
    lines.push(`Total Should Pay,${csvSafe(summary.total_expected)}`);
    lines.push(`Total Paid,${csvSafe(summary.total_paid)}`);
    lines.push(`Balance,${csvSafe(summary.total_balance || summary.total_due)}`);
    lines.push("");
    lines.push("Monthly Breakdown");
    lines.push("Month,Expected Salary,Paid Salary,Due Salary");
    (teacherStatement.months || []).forEach((row) => {
      lines.push(
        [
          csvSafe(row.month_shamsi),
          csvSafe(row.expected_salary),
          csvSafe(row.paid_salary),
          csvSafe(row.due_salary),
        ].join(",")
      );
    });
    lines.push("");
    lines.push("Salary Payments");
    lines.push("ID,Date,Amount,Notes");
    (teacherStatement.salary_payments || []).forEach((item) => {
      lines.push(
        [
          item.id,
          csvSafe(item.date_shamsi),
          csvSafe(item.amount),
          csvSafe(item.notes || ""),
        ].join(",")
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teacher_statement_${teacher.name || teacher.id}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printTeacherStatement = () => {
    if (!teacherStatement) return;
    const reportWindow = window.open("", "_blank", "width=1100,height=900");
    if (!reportWindow) return;
    const teacher = teacherStatement.teacher || {};
    const summary = teacherStatement.summary || {};
    const totalShouldPay = summary.total_expected || "0.00";
    const totalPaid = summary.total_paid || "0.00";
    const totalBalance = summary.total_balance || summary.total_due || "0.00";
    const monthRows = (teacherStatement.months || [])
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.month_shamsi)}</td>
            <td>${escapeHtml(row.expected_salary)}</td>
            <td>${escapeHtml(row.paid_salary)}</td>
            <td>${escapeHtml(row.due_salary)}</td>
          </tr>
        `
      )
      .join("");
    const paymentRows = (teacherStatement.salary_payments || [])
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.date_shamsi)}</td>
            <td>${escapeHtml(item.amount)}</td>
            <td>${escapeHtml(item.notes || "")}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Teacher Statement</title>
          <style>
            body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; padding: 24px; }
            h1 { margin: 0; font-size: 1.4rem; }
            .muted { color: #64748b; font-size: 0.9rem; }
            .head { display:flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 16px; }
            .summary { display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0 18px; }
            .summary-card { border:1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; }
            .summary-card .label { color:#64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
            .summary-card .value { font-size: 16px; font-weight: 700; margin-top: 4px; }
            .info-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
            .info-item { border:1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
            .info-item .label { color:#64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
            .info-item .value { font-weight: 600; margin-top: 4px; }
            .section { margin-top: 20px; }
            .note { margin-top: 8px; color: #64748b; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border:1px solid #e2e8f0; padding: 8px; vertical-align: top; }
            th { background:#f8fafc; text-align:left; }
            .signature { display:flex; justify-content: space-between; gap: 16px; margin-top: 44px; }
            .sig-box { width: 32%; border-top: 1px solid #0f172a; padding-top: 8px; min-height: 44px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="head">
            <div>
              <h1>Teacher Salary Statement</h1>
              <div class="muted">${escapeHtml(teacher.name || "")} | ${escapeHtml(teacher.department || "")}</div>
              <div class="muted">Salary: ${escapeHtml(teacher.salary || "")}</div>
            </div>
            <div style="text-align:right">
              <div class="muted">Created: ${escapeHtml(teacher.created_date_shamsi || "")}</div>
              <div class="muted">Through: ${escapeHtml(teacherStatement.through_month_shamsi || "")}</div>
            </div>
          </div>

          <div class="summary">
            <div class="summary-card"><div class="label">Total Should Pay</div><div class="value">${escapeHtml(totalShouldPay)}</div></div>
            <div class="summary-card"><div class="label">Total Paid</div><div class="value">${escapeHtml(totalPaid)}</div></div>
            <div class="summary-card"><div class="label">Balance</div><div class="value">${escapeHtml(totalBalance)}</div></div>
          </div>

          <div class="section">
            <h3>Teacher Information</h3>
            <div class="info-grid">
              <div class="info-item"><div class="label">Teacher</div><div class="value">${escapeHtml(teacher.name || "")}</div></div>
              <div class="info-item"><div class="label">Department</div><div class="value">${escapeHtml(teacher.department || "")}</div></div>
              <div class="info-item"><div class="label">Phone</div><div class="value">${escapeHtml(teacher.phone || "")}</div></div>
              <div class="info-item"><div class="label">Salary</div><div class="value">${escapeHtml(teacher.salary || "")}</div></div>
            </div>
            <div class="note">This statement shows the monthly salary due, recorded salary payments, and the remaining balance.</div>
          </div>

          <div class="section">
            <h3>Monthly Breakdown</h3>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Expected Salary</th>
                  <th>Paid Salary</th>
                  <th>Due Salary</th>
                </tr>
              </thead>
              <tbody>${monthRows || '<tr><td colspan="4">No salary rows.</td></tr>'}</tbody>
            </table>
          </div>

          <div class="section">
            <h3>Salary Payments</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>${paymentRows || '<tr><td colspan="3">No salary payments found.</td></tr>'}</tbody>
            </table>
          </div>

          <div class="signature">
            <div class="sig-box">Teacher Signature</div>
            <div class="sig-box">Accounts / Finance</div>
            <div class="sig-box">Authorized Signature and Stamp</div>
          </div>
        </body>
      </html>
    `;
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  const exportTeacherSalaryListExcel = async () => {
    if (!teacherSalaryList) return;
    setExportingTeacherSalaryExcel(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = template.schoolName || "School Finance";
      const sheet = workbook.addWorksheet("لیست معاشات", {
        views: [{ rightToLeft: true, state: "frozen", xSplit: 4, ySplit: 2 }],
      });

      const thinBorder = {
        top: { style: "thin", color: { argb: "FF334155" } },
        left: { style: "thin", color: { argb: "FF334155" } },
        bottom: { style: "thin", color: { argb: "FF334155" } },
        right: { style: "thin", color: { argb: "FF334155" } },
      };
      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      const titleFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
      const totalFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

      const monthLabels = teacherSalaryList.month_labels || [];
      const totalCols = 4 + monthLabels.length + 2;
      sheet.getColumn(1).width = 8;
      sheet.getColumn(2).width = 16;
      sheet.getColumn(3).width = 16;
      sheet.getColumn(4).width = 14;
      for (let i = 5; i <= totalCols; i += 1) {
        sheet.getColumn(i).width = 11;
      }

      sheet.mergeCells(1, 1, 1, totalCols);
      const title = sheet.getCell(1, 1);
      title.value = `لیست معاشات پرسونل ${template.schoolName || ""} سال ${teacherSalaryList.year_shamsi}`;
      title.font = { bold: true, size: 13 };
      title.alignment = { horizontal: "center", vertical: "middle" };
      title.fill = titleFill;
      for (let c = 1; c <= totalCols; c += 1) {
        sheet.getCell(1, c).border = thinBorder;
      }
      sheet.getRow(1).height = 24;

      ["شماره", "اسم", "ولد", "وظیفه"].forEach((label, idx) => {
        const cell = sheet.getCell(2, idx + 1);
        cell.value = label;
        cell.font = { bold: true };
        cell.fill = headerFill;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      monthLabels.forEach((month, index) => {
        const cell = sheet.getCell(2, 5 + index);
        cell.value = month.label;
        cell.font = { bold: true };
        cell.fill = headerFill;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      const monthsPaidCol = 5 + monthLabels.length;
      const totalSalaryCol = monthsPaidCol + 1;
      sheet.getCell(2, monthsPaidCol).value = "مجموعه ماه";
      sheet.getCell(2, totalSalaryCol).value = "مجموعه معاش";
      [monthsPaidCol, totalSalaryCol].forEach((col) => {
        sheet.getCell(2, col).font = { bold: true };
        sheet.getCell(2, col).fill = headerFill;
        sheet.getCell(2, col).alignment = { horizontal: "center", vertical: "middle" };
      });

      for (let c = 1; c <= totalCols; c += 1) {
        sheet.getCell(2, c).border = thinBorder;
        sheet.getCell(2, c).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      }

      let rowNum = 3;
      (teacherSalaryList.rows || []).forEach((row) => {
        sheet.getCell(rowNum, 1).value = row.row_number;
        sheet.getCell(rowNum, 2).value = row.name || "";
        sheet.getCell(rowNum, 3).value = row.father_name || "";
        sheet.getCell(rowNum, 4).value = row.department || "";
        (row.months || []).forEach((month, index) => {
          const col = 5 + index;
          const paidNum = month.has_payment ? Number(month.paid) : null;
          sheet.getCell(rowNum, col).value = month.has_payment
            ? Number.isFinite(paidNum)
              ? paidNum
              : month.paid_display
            : "//";
          if (month.has_payment && Number.isFinite(paidNum)) {
            sheet.getCell(rowNum, col).numFmt = "#,##0.00";
          }
        });
        sheet.getCell(rowNum, monthsPaidCol).value = row.months_paid_count;
        const totalNum = Number(row.total_salary);
        sheet.getCell(rowNum, totalSalaryCol).value = Number.isFinite(totalNum) ? totalNum : row.total_salary;
        sheet.getCell(rowNum, totalSalaryCol).numFmt = "#,##0.00";
        for (let c = 1; c <= totalCols; c += 1) {
          sheet.getCell(rowNum, c).border = thinBorder;
          sheet.getCell(rowNum, c).alignment = { horizontal: "center", vertical: "middle" };
        }
        sheet.getCell(rowNum, 2).alignment = { horizontal: "right", vertical: "middle" };
        sheet.getCell(rowNum, 3).alignment = { horizontal: "right", vertical: "middle" };
        sheet.getCell(rowNum, 4).alignment = { horizontal: "right", vertical: "middle" };
        rowNum += 1;
      });

      sheet.getCell(rowNum, 1).value = "";
      sheet.mergeCells(rowNum, 2, rowNum, 4);
      sheet.getCell(rowNum, 2).value = "مجموعه";
      (teacherSalaryList.summary?.month_totals || []).forEach((month, index) => {
        const col = 5 + index;
        sheet.getCell(rowNum, col).value = Number(month.salary || 0);
        sheet.getCell(rowNum, col).numFmt = "#,##0.00";
      });
      sheet.getCell(rowNum, totalSalaryCol).value = Number(teacherSalaryList.summary?.total_salary || 0);
      sheet.getCell(rowNum, totalSalaryCol).numFmt = "#,##0.00";
      for (let c = 1; c <= totalCols; c += 1) {
        sheet.getCell(rowNum, c).border = thinBorder;
        sheet.getCell(rowNum, c).font = { bold: true };
        sheet.getCell(rowNum, c).fill = totalFill;
        sheet.getCell(rowNum, c).alignment = { horizontal: "center", vertical: "middle" };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `teacher_salary_list_${teacherSalaryList.year_shamsi}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setTeacherSalaryError(err.message || "Failed to export Excel file.");
    } finally {
      setExportingTeacherSalaryExcel(false);
    }
  };

  const printTeacherSalaryList = () => {
    if (!teacherSalaryList) return;
    const reportWindow = window.open("", "_blank", "width=1400,height=900");
    if (!reportWindow) return;
    const monthLabels = teacherSalaryList.month_labels || [];
    const headMonths = monthLabels.map((month) => `<th>${escapeHtml(month.label)}</th>`).join("");
    const bodyRows = (teacherSalaryList.rows || [])
      .map((row) => {
        const months = (row.months || [])
          .map((month) => `<td>${escapeHtml(month.paid_display)}</td>`)
          .join("");
        return `<tr>
          <td>${escapeHtml(row.row_number)}</td>
          <td class="name">${escapeHtml(row.name)}</td>
          <td class="name">${escapeHtml(row.father_name)}</td>
          <td class="name">${escapeHtml(row.department)}</td>
          ${months}
          <td>${escapeHtml(row.months_paid_count)}</td>
          <td>${escapeHtml(row.total_salary)}</td>
        </tr>`;
      })
      .join("");
    const totalMonths = (teacherSalaryList.summary?.month_totals || [])
      .map((month) => `<td>${escapeHtml(month.salary)}</td>`)
      .join("");
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>لیست معاشات</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            body { font-family: Tahoma, "Segoe UI", sans-serif; direction: rtl; color: #0f172a; }
            h1 { margin: 0 0 10px; font-size: 1.1rem; text-align: center; }
            table { width: 100%; border-collapse: collapse; font-size: 9px; }
            th, td { border: 1px solid #334155; padding: 3px 4px; text-align: center; }
            th { background: #e2e8f0; }
            td.name { text-align: right; }
            tfoot td { background: #f1f5f9; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>لیست معاشات پرسونل ${escapeHtml(template.schoolName || "")} سال ${escapeHtml(teacherSalaryList.year_shamsi)}</h1>
          <table>
            <thead>
              <tr>
                <th>شماره</th>
                <th>اسم</th>
                <th>ولد</th>
                <th>وظیفه</th>
                ${headMonths}
                <th>مجموعه ماه</th>
                <th>مجموعه معاش</th>
              </tr>
            </thead>
            <tbody>${bodyRows || '<tr><td colspan="18">موردی یافت نشد</td></tr>'}</tbody>
            <tfoot>
              <tr>
                <td colspan="4">مجموعه</td>
                ${totalMonths}
                <td></td>
                <td>${escapeHtml(teacherSalaryList.summary?.total_salary || "0.00")}</td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `;
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  const exportStudentPaymentListExcel = async () => {
    if (!studentPaymentList) return;
    setExportingStudentPaymentExcel(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = template.schoolName || "School Finance";
      const sheet = workbook.addWorksheet(studentPaymentStatusOnly ? "وضعیت پرداخت" : "پرداخت شاگردان", {
        views: [{ rightToLeft: true, state: "frozen", xSplit: 5, ySplit: 3 }],
      });

      const thinBorder = {
        top: { style: "thin", color: { argb: "FF334155" } },
        left: { style: "thin", color: { argb: "FF334155" } },
        bottom: { style: "thin", color: { argb: "FF334155" } },
        right: { style: "thin", color: { argb: "FF334155" } },
      };
      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      const titleFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
      const totalFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      const paidFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
      const unpaidFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };

      const categories = studentPaymentList.categories || [];
      const monthLabels = studentPaymentList.month_labels || [];
      const catCount = categories.length;
      const monthSpan = studentPaymentStatusOnly ? catCount : catCount + 1;
      const totalCols = studentPaymentStatusOnly
        ? 5 + monthLabels.length * monthSpan
        : 5 + monthLabels.length * monthSpan + catCount + 1;

      for (let i = 1; i <= totalCols; i += 1) {
        sheet.getColumn(i).width = i <= 5 ? 14 : studentPaymentStatusOnly ? 8 : 11;
      }
      sheet.getColumn(1).width = 8;
      sheet.getColumn(2).width = 16;

      sheet.mergeCells(1, 1, 1, Math.max(totalCols, 6));
      const title = sheet.getCell(1, 1);
      title.value = studentPaymentStatusOnly
        ? `وضعیت پرداخت شاگردان ${template.schoolName || ""} سال ${studentPaymentList.year_shamsi} (✓ پرداخت شده / ✗ نپرداخته)`
        : `لیست پرداخت‌های شاگردان ${template.schoolName || ""} سال ${studentPaymentList.year_shamsi}`;
      title.font = { bold: true, size: 13 };
      title.alignment = { horizontal: "center", vertical: "middle" };
      title.fill = titleFill;
      sheet.getRow(1).height = 24;

      const fixedHeaders = ["شماره", "اسم", "نمبر ثبت", "ولد", "صنف"];
      fixedHeaders.forEach((label, idx) => {
        sheet.mergeCells(2, idx + 1, 3, idx + 1);
        const cell = sheet.getCell(2, idx + 1);
        cell.value = label;
        cell.font = { bold: true };
        cell.fill = headerFill;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      let col = 6;
      monthLabels.forEach((month) => {
        sheet.mergeCells(2, col, 2, col + monthSpan - 1);
        const monthCell = sheet.getCell(2, col);
        monthCell.value = month.label;
        monthCell.font = { bold: true };
        monthCell.fill = headerFill;
        monthCell.alignment = { horizontal: "center", vertical: "middle" };
        categories.forEach((category, index) => {
          const cell = sheet.getCell(3, col + index);
          cell.value = category.label;
          cell.font = { bold: true };
          cell.fill = headerFill;
        });
        if (!studentPaymentStatusOnly) {
          const totalCell = sheet.getCell(3, col + catCount);
          totalCell.value = "جمع ماه";
          totalCell.font = { bold: true };
          totalCell.fill = headerFill;
        }
        col += monthSpan;
      });

      if (!studentPaymentStatusOnly) {
        categories.forEach((category, index) => {
          sheet.mergeCells(2, col + index, 3, col + index);
          const cell = sheet.getCell(2, col + index);
          cell.value = `مجموعه ${category.label}`;
          cell.font = { bold: true };
          cell.fill = headerFill;
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        });
        sheet.mergeCells(2, col + catCount, 3, col + catCount);
        const subtotalHeader = sheet.getCell(2, col + catCount);
        subtotalHeader.value = "مجموعه شاگرد";
        subtotalHeader.font = { bold: true };
        subtotalHeader.fill = headerFill;
        subtotalHeader.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      }

      for (let r = 2; r <= 3; r += 1) {
        for (let c = 1; c <= totalCols; c += 1) {
          sheet.getCell(r, c).border = thinBorder;
          sheet.getCell(r, c).alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
        }
      }

      let rowNum = 4;
      (studentPaymentList.rows || []).forEach((row) => {
        sheet.getCell(rowNum, 1).value = row.row_number;
        sheet.getCell(rowNum, 2).value = row.name || "";
        sheet.getCell(rowNum, 3).value = row.registration_number || "";
        sheet.getCell(rowNum, 4).value = row.father_name || "";
        sheet.getCell(rowNum, 5).value = row.class_name || "";
        let c = 6;
        (row.months || []).forEach((month) => {
          categories.forEach((category) => {
            const cell = sheet.getCell(rowNum, c);
            if (studentPaymentStatusOnly) {
              const paid = isStudentCategoryPaid(month, category.key);
              cell.value = paid ? "✓" : "✗";
              cell.fill = paid ? paidFill : unpaidFill;
              cell.font = { bold: true, color: { argb: paid ? "FF166534" : "FF991B1B" } };
            } else {
              const display = month.displays?.[category.key];
              const raw = month.amounts?.[category.key];
              const num = Number(raw);
              cell.value = display === "//" ? "//" : Number.isFinite(num) ? num : display || "//";
              if (display !== "//" && Number.isFinite(num)) {
                cell.numFmt = "#,##0.00";
              }
            }
            c += 1;
          });
          if (!studentPaymentStatusOnly) {
            const monthTotalNum = Number(month.month_total);
            sheet.getCell(rowNum, c).value =
              month.month_total === "//"
                ? "//"
                : Number.isFinite(monthTotalNum)
                  ? monthTotalNum
                  : month.month_total;
            if (month.month_total !== "//" && Number.isFinite(monthTotalNum)) {
              sheet.getCell(rowNum, c).numFmt = "#,##0.00";
            }
            c += 1;
          }
        });
        if (!studentPaymentStatusOnly) {
          categories.forEach((category) => {
            const num = Number(row.category_totals?.[category.key] || 0);
            sheet.getCell(rowNum, c).value = num;
            sheet.getCell(rowNum, c).numFmt = "#,##0.00";
            c += 1;
          });
          const subtotalNum = Number(row.subtotal || 0);
          sheet.getCell(rowNum, c).value = subtotalNum;
          sheet.getCell(rowNum, c).numFmt = "#,##0.00";
        }

        for (let i = 1; i <= totalCols; i += 1) {
          sheet.getCell(rowNum, i).border = thinBorder;
          sheet.getCell(rowNum, i).alignment = { horizontal: "center", vertical: "middle" };
        }
        sheet.getCell(rowNum, 2).alignment = { horizontal: "right", vertical: "middle" };
        sheet.getCell(rowNum, 4).alignment = { horizontal: "right", vertical: "middle" };
        sheet.getCell(rowNum, 5).alignment = { horizontal: "right", vertical: "middle" };
        rowNum += 1;
      });

      if (!studentPaymentStatusOnly) {
        sheet.mergeCells(rowNum, 1, rowNum, 5);
        sheet.getCell(rowNum, 1).value = "مجموعه نهایی";
        let footerCol = 6;
        (studentPaymentList.summary?.month_totals || []).forEach((month) => {
          categories.forEach((category) => {
            const num = Number(month.amounts?.[category.key] || 0);
            sheet.getCell(rowNum, footerCol).value = num;
            sheet.getCell(rowNum, footerCol).numFmt = "#,##0.00";
            footerCol += 1;
          });
          const monthTotalNum = Number(month.month_total || 0);
          sheet.getCell(rowNum, footerCol).value = monthTotalNum;
          sheet.getCell(rowNum, footerCol).numFmt = "#,##0.00";
          footerCol += 1;
        });
        categories.forEach((category) => {
          const num = Number(studentPaymentList.summary?.category_totals?.[category.key] || 0);
          sheet.getCell(rowNum, footerCol).value = num;
          sheet.getCell(rowNum, footerCol).numFmt = "#,##0.00";
          footerCol += 1;
        });
        sheet.getCell(rowNum, footerCol).value = Number(studentPaymentList.summary?.grand_total || 0);
        sheet.getCell(rowNum, footerCol).numFmt = "#,##0.00";
        for (let i = 1; i <= totalCols; i += 1) {
          sheet.getCell(rowNum, i).border = thinBorder;
          sheet.getCell(rowNum, i).font = { bold: true };
          sheet.getCell(rowNum, i).fill = totalFill;
          sheet.getCell(rowNum, i).alignment = { horizontal: "center", vertical: "middle" };
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = studentPaymentStatusOnly
        ? `student_payment_status_${studentPaymentList.year_shamsi}.xlsx`
        : `student_payment_list_${studentPaymentList.year_shamsi}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setStudentPaymentError(err.message || "Failed to export Excel file.");
    } finally {
      setExportingStudentPaymentExcel(false);
    }
  };

  const printStudentPaymentList = () => {
    if (!studentPaymentList) return;
    const reportWindow = window.open("", "_blank", "width=1400,height=900");
    if (!reportWindow) return;
    const categories = studentPaymentList.categories || [];
    const monthLabels = studentPaymentList.month_labels || [];
    const monthSpan = studentPaymentStatusOnly ? categories.length : categories.length + 1;
    const headMonths = monthLabels
      .map((month) => `<th colspan="${monthSpan}">${escapeHtml(month.label)}</th>`)
      .join("");
    const subHeadMonths = monthLabels
      .map(
        () =>
          `${categories.map((category) => `<th>${escapeHtml(category.label)}</th>`).join("")}${
            studentPaymentStatusOnly ? "" : "<th>جمع ماه</th>"
          }`
      )
      .join("");
    const categoryTotalHeads = studentPaymentStatusOnly
      ? ""
      : categories.map((category) => `<th rowspan="2">مجموعه ${escapeHtml(category.label)}</th>`).join("");
    const bodyRows = (studentPaymentList.rows || [])
      .map((row) => {
        const months = (row.months || [])
          .map((month) => {
            const cats = categories
              .map((category) => {
                if (studentPaymentStatusOnly) {
                  const paid = isStudentCategoryPaid(month, category.key);
                  return `<td class="${paid ? "paid" : "unpaid"}">${paid ? "✓" : "✗"}</td>`;
                }
                return `<td>${escapeHtml(month.displays?.[category.key] || "//")}</td>`;
              })
              .join("");
            return studentPaymentStatusOnly
              ? cats
              : `${cats}<td>${escapeHtml(month.month_total)}</td>`;
          })
          .join("");
        const catTotals = studentPaymentStatusOnly
          ? ""
          : categories
              .map((category) => `<td>${escapeHtml(row.category_totals?.[category.key] || "0.00")}</td>`)
              .join("");
        const subtotalCell = studentPaymentStatusOnly ? "" : `<td>${escapeHtml(row.subtotal)}</td>`;
        return `<tr>
          <td>${escapeHtml(row.row_number)}</td>
          <td class="name">${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.registration_number)}</td>
          <td class="name">${escapeHtml(row.father_name)}</td>
          <td class="name">${escapeHtml(row.class_name)}</td>
          ${months}
          ${catTotals}
          ${subtotalCell}
        </tr>`;
      })
      .join("");
    const footerRow = studentPaymentStatusOnly
      ? ""
      : (() => {
          const footerMonths = (studentPaymentList.summary?.month_totals || [])
            .map((month) => {
              const cats = categories
                .map((category) => `<td>${escapeHtml(month.amounts?.[category.key] || "0.00")}</td>`)
                .join("");
              return `${cats}<td>${escapeHtml(month.month_total)}</td>`;
            })
            .join("");
          const footerCats = categories
            .map(
              (category) =>
                `<td>${escapeHtml(studentPaymentList.summary?.category_totals?.[category.key] || "0.00")}</td>`
            )
            .join("");
          return `<tfoot>
              <tr>
                <td colspan="5">مجموعه نهایی</td>
                ${footerMonths}
                ${footerCats}
                <td>${escapeHtml(studentPaymentList.summary?.grand_total || "0.00")}</td>
              </tr>
            </tfoot>`;
        })();
    const reportTitle = studentPaymentStatusOnly
      ? `وضعیت پرداخت شاگردان ${escapeHtml(template.schoolName || "")} سال ${escapeHtml(studentPaymentList.year_shamsi)} (✓ پرداخت شده / ✗ نپرداخته)`
      : `لیست پرداخت‌های شاگردان ${escapeHtml(template.schoolName || "")} سال ${escapeHtml(studentPaymentList.year_shamsi)}`;
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${studentPaymentStatusOnly ? "وضعیت پرداخت شاگردان" : "لیست پرداخت شاگردان"}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            body { font-family: Tahoma, "Segoe UI", sans-serif; direction: rtl; color: #0f172a; }
            h1 { margin: 0 0 10px; font-size: 1.05rem; text-align: center; }
            table { width: 100%; border-collapse: collapse; font-size: 8px; }
            th, td { border: 1px solid #334155; padding: 2px 3px; text-align: center; }
            th { background: #e2e8f0; }
            td.name { text-align: right; }
            td.paid { color: #166534; font-weight: 700; background: #dcfce7; }
            td.unpaid { color: #991b1b; font-weight: 700; background: #fee2e2; }
            tfoot td { background: #f1f5f9; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>${reportTitle}</h1>
          <table>
            <thead>
              <tr>
                <th rowspan="2">شماره</th>
                <th rowspan="2">اسم</th>
                <th rowspan="2">نمبر ثبت</th>
                <th rowspan="2">ولد</th>
                <th rowspan="2">صنف</th>
                ${headMonths}
                ${categoryTotalHeads}
                ${studentPaymentStatusOnly ? "" : '<th rowspan="2">مجموعه شاگرد</th>'}
              </tr>
              <tr>${subHeadMonths}</tr>
            </thead>
            <tbody>${bodyRows || '<tr><td colspan="20">موردی یافت نشد</td></tr>'}</tbody>
            ${footerRow}
          </table>
        </body>
      </html>
    `;
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  const exportExpenseStatementExcel = async () => {
    if (!expenseStatement) return;
    setExportingExpenseExcel(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = template.schoolName || "School Finance";
      workbook.created = new Date();

      const sheet = workbook.addWorksheet("مصارف", {
        views: [{ rightToLeft: true, state: "frozen", ySplit: 5 }],
      });

      const thinBorder = {
        top: { style: "thin", color: { argb: "FF334155" } },
        left: { style: "thin", color: { argb: "FF334155" } },
        bottom: { style: "thin", color: { argb: "FF334155" } },
        right: { style: "thin", color: { argb: "FF334155" } },
      };
      const headerFill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };
      const totalFill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      const titleFill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDBEAFE" },
      };

      const applyRangeBorder = (rowNumber, fromCol, toCol) => {
        const row = sheet.getRow(rowNumber);
        for (let col = fromCol; col <= toCol; col += 1) {
          row.getCell(col).border = thinBorder;
          row.getCell(col).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        }
      };

      sheet.columns = [
        { key: "no", width: 10 },
        { key: "item", width: 32 },
        { key: "qty", width: 12 },
        { key: "amount", width: 14 },
        { key: "bill", width: 16 },
        { key: "notes", width: 28 },
      ];

      const categoryLabel = expenseStatement.filters?.all_categories
        ? "همه کتگوری‌ها"
        : expenseStatement.category?.name || "مصارف";

      sheet.mergeCells(1, 1, 1, 6);
      const titleCell = sheet.getCell(1, 1);
      titleCell.value = `${template.schoolName || "لیسه خصوصی وطن"} — راپور مصارف`;
      titleCell.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      titleCell.fill = titleFill;
      applyRangeBorder(1, 1, 6);
      sheet.getRow(1).height = 24;

      sheet.getCell(2, 1).value = "کتگوری";
      sheet.getCell(2, 2).value = categoryLabel;
      sheet.mergeCells(2, 2, 2, 6);
      sheet.getCell(3, 1).value = "از تاریخ";
      sheet.getCell(3, 2).value = expenseStatement.filters?.start || "همه";
      sheet.mergeCells(3, 2, 3, 6);
      sheet.getCell(4, 1).value = "تا تاریخ";
      sheet.getCell(4, 2).value = expenseStatement.filters?.end || "همه";
      sheet.mergeCells(4, 2, 4, 6);
      sheet.getCell(5, 1).value = "مجموعه مصارف";
      sheet.getCell(5, 2).value = Number(expenseStatement.summary?.total_amount || 0);
      sheet.getCell(5, 2).numFmt = "#,##0.00";
      sheet.mergeCells(5, 2, 5, 6);

      for (let r = 2; r <= 5; r += 1) {
        sheet.getCell(r, 1).font = { bold: true };
        sheet.getCell(r, 1).fill = headerFill;
        applyRangeBorder(r, 1, 6);
        sheet.getCell(r, 2).alignment = { horizontal: "right", vertical: "middle" };
      }

      let rowNum = 7;
      const headers = ["شماره", "اسم جنس", "تعداد", "مقدار مصرف", "نمبر بل", "ملاحظات"];

      (expenseStatement.sections || []).forEach((section) => {
        sheet.mergeCells(rowNum, 1, rowNum, 6);
        const sectionCell = sheet.getCell(rowNum, 1);
        sectionCell.value = section.category?.name || "";
        sectionCell.font = { bold: true, size: 12 };
        sectionCell.fill = titleFill;
        sectionCell.alignment = { horizontal: "center", vertical: "middle" };
        applyRangeBorder(rowNum, 1, 6);
        sheet.getRow(rowNum).height = 22;
        rowNum += 1;

        headers.forEach((label, index) => {
          const cell = sheet.getCell(rowNum, index + 1);
          cell.value = label;
          cell.font = { bold: true };
          cell.fill = headerFill;
        });
        applyRangeBorder(rowNum, 1, 6);
        rowNum += 1;

        (section.items || []).forEach((item) => {
          sheet.getCell(rowNum, 1).value = item.row_number;
          sheet.getCell(rowNum, 2).value = item.item_name || "";
          sheet.getCell(rowNum, 3).value = item.quantity || "";
          const amountNum = Number(item.amount);
          sheet.getCell(rowNum, 4).value = Number.isFinite(amountNum) ? amountNum : item.amount || 0;
          sheet.getCell(rowNum, 4).numFmt = "#,##0.00";
          sheet.getCell(rowNum, 5).value = item.bill_number || "";
          sheet.getCell(rowNum, 6).value = item.notes || "";
          applyRangeBorder(rowNum, 1, 6);
          sheet.getCell(rowNum, 2).alignment = { horizontal: "right", vertical: "middle", wrapText: true };
          sheet.getCell(rowNum, 6).alignment = { horizontal: "right", vertical: "middle", wrapText: true };
          rowNum += 1;
        });

        sheet.getCell(rowNum, 1).value = "";
        sheet.getCell(rowNum, 2).value = "جمله شد بل";
        sheet.getCell(rowNum, 3).value = "";
        const sectionTotal = Number(section.summary?.total_amount || 0);
        sheet.getCell(rowNum, 4).value = sectionTotal;
        sheet.getCell(rowNum, 4).numFmt = "#,##0.00";
        sheet.getCell(rowNum, 5).value = "";
        sheet.getCell(rowNum, 6).value = "";
        for (let col = 1; col <= 6; col += 1) {
          sheet.getCell(rowNum, col).font = { bold: true };
          sheet.getCell(rowNum, col).fill = totalFill;
        }
        applyRangeBorder(rowNum, 1, 6);
        sheet.getCell(rowNum, 2).alignment = { horizontal: "right", vertical: "middle" };
        rowNum += 2;
      });

      if ((expenseStatement.sections || []).length > 1) {
        sheet.mergeCells(rowNum, 1, rowNum, 3);
        sheet.getCell(rowNum, 1).value = "مجموعه کل";
        sheet.getCell(rowNum, 1).font = { bold: true, size: 12 };
        sheet.getCell(rowNum, 4).value = Number(expenseStatement.summary?.total_amount || 0);
        sheet.getCell(rowNum, 4).numFmt = "#,##0.00";
        sheet.getCell(rowNum, 4).font = { bold: true, size: 12 };
        for (let col = 1; col <= 6; col += 1) {
          sheet.getCell(rowNum, col).fill = totalFill;
        }
        applyRangeBorder(rowNum, 1, 6);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = String(categoryLabel).replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
      const start = expenseStatement.filters?.start || "all";
      const end = expenseStatement.filters?.end || "all";
      a.download = `expense_report_${safeName}_${start}_${end}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExpenseStatementError(err.message || "Failed to export Excel file.");
    } finally {
      setExportingExpenseExcel(false);
    }
  };

  const printExpenseStatement = () => {
    if (!expenseStatement) return;
    const reportWindow = window.open("", "_blank", "width=1100,height=900");
    if (!reportWindow) return;
    const sectionHtml = (expenseStatement.sections || [])
      .map((section) => {
        const itemRows = (section.items || [])
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.row_number)}</td>
                <td class="item">${escapeHtml(item.item_name || "")}</td>
                <td>${escapeHtml(item.quantity || "")}</td>
                <td>${escapeHtml(item.amount)}</td>
                <td>${escapeHtml(item.bill_number || "")}</td>
                <td class="notes">${escapeHtml(item.notes || "")}</td>
              </tr>
            `
          )
          .join("");
        return `
          <section class="block">
            <h2>${escapeHtml(section.category?.name || "")}</h2>
            <table>
              <thead>
                <tr>
                  <th>شماره</th>
                  <th>اسم جنس</th>
                  <th>تعداد</th>
                  <th>مقدار مصرف</th>
                  <th>نمبر بل</th>
                  <th>ملاحظات</th>
                </tr>
              </thead>
              <tbody>${itemRows || '<tr><td colspan="6">موردی یافت نشد</td></tr>'}</tbody>
              <tfoot>
                <tr>
                  <td></td>
                  <td class="item">جمله شد بل</td>
                  <td></td>
                  <td>${escapeHtml(section.summary?.total_amount || "0.00")}</td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </section>
        `;
      })
      .join("");
    const title = expenseStatement.filters?.all_categories
      ? "راپور مصارف (همه کتگوری‌ها)"
      : expenseStatement.category?.name || "راپور مصارف";
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: "Segoe UI", Tahoma, "Noto Naskh Arabic", Arial, sans-serif; color: #0f172a; padding: 8px; direction: rtl; }
            h1 { margin: 0 0 4px; font-size: 1.25rem; }
            h2 { margin: 0 0 8px; font-size: 1.05rem; }
            .muted { color: #475569; font-size: 0.88rem; }
            .head { display:flex; justify-content: space-between; gap: 16px; margin-bottom: 14px; border-bottom: 2px solid #334155; padding-bottom: 10px; }
            .block { margin-bottom: 22px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #334155; padding: 7px 8px; text-align: center; }
            th { background: #e2e8f0; font-weight: 700; }
            td.item, td.notes { text-align: right; }
            tfoot td { background: #f1f5f9; font-weight: 700; }
            .grand { margin-top: 10px; border: 1px solid #334155; padding: 10px; font-weight: 700; background: #f8fafc; }
            .signature { display:flex; justify-content: space-between; gap: 16px; margin-top: 40px; }
            .sig-box { width: 30%; border-top: 1px solid #0f172a; padding-top: 8px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="head">
            <div>
              <h1>${escapeHtml(title)}</h1>
              <div class="muted">${escapeHtml(template.schoolName || "")}</div>
            </div>
            <div>
              <div class="muted">از: ${escapeHtml(expenseStatement.filters?.start || "همه")}</div>
              <div class="muted">تا: ${escapeHtml(expenseStatement.filters?.end || "همه")}</div>
              <div class="muted">مجموعه: ${escapeHtml(expenseStatement.summary?.total_amount || "0.00")}</div>
            </div>
          </div>
          ${sectionHtml || "<p>موردی یافت نشد</p>"}
          ${(expenseStatement.sections || []).length > 1 ? `<div class="grand">مجموعه کل: ${escapeHtml(expenseStatement.summary?.total_amount || "0.00")}</div>` : ""}
          <div class="signature">
            <div class="sig-box">آماده‌کننده</div>
            <div class="sig-box">حسابداری / مالی</div>
            <div class="sig-box">امضا و مهر</div>
          </div>
        </body>
      </html>
    `;
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  const escapeHtml = (value) => {
    const str = value === null || value === undefined ? "" : String(value);
    return str.replace(/[&<>"']/g, (ch) => {
      switch (ch) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#039;";
        default:
          return ch;
      }
    });
  };

  const csvSafe = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

  const onTemplateChange = (field) => (event) => {
    setTemplate((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const onLogoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setTemplate((prev) => ({ ...prev, logoDataUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const saveTemplate = () => {
    setSavingTemplate(true);
    localStorage.setItem(RECEIPT_TEMPLATE_KEY, JSON.stringify(template));
    setTemplateStatus("Receipt template saved.");
    setTimeout(() => setSavingTemplate(false), 200);
  };

  const clearLogo = () => {
    setTemplate((prev) => ({ ...prev, logoDataUrl: "" }));
  };

  const exportReportCsv = () => {
    if (!summary) return;
    const lines = [];
    lines.push(`School,${template.schoolName}`);
    lines.push(`Address,${template.schoolAddress}`);
    lines.push(`Phone,${template.schoolPhone}`);
    lines.push(`Period,${filters.period}`);
    lines.push(`Total Revenue,${summary.total_revenue || 0}`);
    lines.push(`Total Expenses,${summary.total_expenses || 0}`);
    lines.push(`Expense Records,${summary.expense_records_total || 0}`);
    lines.push(`Teacher Salaries,${summary.teacher_salaries_total || 0}`);
    lines.push(`Profit,${summary.profit || 0}`);
    lines.push("");
    lines.push("Payments");
    lines.push("ID,Student,Type,Amount,Date");
    (summary.payments || []).forEach((item) => {
      lines.push(
        [
          item.id,
          `"${String(item.student_name || item.student || "").replaceAll('"', '""')}"`,
          `"${String(item.fee_type_name || item.fee_type || "").replaceAll('"', '""')}"`,
          item.amount,
          item.date_shamsi,
        ].join(",")
      );
    });
    lines.push("");
    lines.push("Expenses");
    lines.push("ID,Category,Amount,Date,Paid By");
    (summary.expenses || []).forEach((item) => {
      lines.push(
        [
          item.id,
          `"${String(item.category_name || item.category || "").replaceAll('"', '""')}"`,
          item.amount,
          item.date_shamsi,
          `"${String(item.paid_by || "").replaceAll('"', '""')}"`,
        ].join(",")
      );
    });
    lines.push("");
    lines.push("Teacher Salaries");
    lines.push("ID,Teacher,Department,Amount,Date");
    (summary.teacher_salary_payments || []).forEach((item) => {
      lines.push(
        [
          item.id,
          `"${String(item.teacher_name || item.teacher || "").replaceAll('"', '""')}"`,
          `"${String(item.teacher_department || "").replaceAll('"', '""')}"`,
          item.amount,
          item.date_shamsi,
        ].join(",")
      );
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "financial_report.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportReportPdf = () => {
    if (!summary) return;
    const reportWindow = window.open("", "_blank", "width=1100,height=900");
    if (!reportWindow) return;
    const paymentsRows = (summary.payments || [])
      .map(
        (item) => `
          <tr>
            <td>${item.id}</td>
            <td>${item.student_name || item.student || ""}</td>
            <td>${item.fee_type_name || item.fee_type || ""}</td>
            <td>${item.amount}</td>
            <td>${item.date_shamsi}</td>
          </tr>
        `
      )
      .join("");
    const expensesRows = (summary.expenses || [])
      .map(
        (item) => `
          <tr>
            <td>${item.id}</td>
            <td>${item.category_name || item.category || ""}</td>
            <td>${item.amount}</td>
            <td>${item.date_shamsi}</td>
            <td>${item.paid_by || ""}</td>
          </tr>
        `
      )
      .join("");
    const salaryRows = (summary.teacher_salary_payments || [])
      .map(
        (item) => `
          <tr>
            <td>${item.id}</td>
            <td>${item.teacher_name || item.teacher || ""}</td>
            <td>${item.teacher_department || ""}</td>
            <td>${item.amount}</td>
            <td>${item.date_shamsi}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <html>
        <head>
          <title>Financial Report</title>
          <style>
            body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; padding: 24px; }
            .head { display:flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
            .brand { display:flex; gap: 12px; align-items: center; }
            .logo { width:64px; height:64px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
            .title { font-size: 1.4rem; font-weight: 800; margin: 0; }
            .muted { color:#64748b; }
            .kpi { display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0; }
            .k { border:1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
            table { width:100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border:1px solid #e2e8f0; padding: 8px; text-align:left; font-size: 0.9rem; }
            th { background:#f8fafc; }
            h3 { margin-top: 20px; margin-bottom: 8px; }
            @media print { .no-print { display:none !important; } }
          </style>
        </head>
        <body>
          <div class="head">
            <div class="brand">
              ${
                template.logoDataUrl
                  ? `<img src="${template.logoDataUrl}" class="logo" alt="School logo" />`
                  : `<div class="logo"></div>`
              }
              <div>
                <p class="title">${template.schoolName}</p>
                <div class="muted">${template.schoolAddress}</div>
                <div class="muted">${template.schoolPhone}</div>
              </div>
            </div>
            <div>
              <div class="muted">Financial Report</div>
              <div class="muted">Period: ${filters.period}</div>
            </div>
          </div>

          <div class="kpi">
            <div class="k"><div class="muted">Total Revenue</div><strong>${summary.total_revenue || 0}</strong></div>
            <div class="k"><div class="muted">Total Expenses</div><strong>${summary.total_expenses || 0}</strong></div>
            <div class="k"><div class="muted">Profit</div><strong>${summary.profit || 0}</strong></div>
            <div class="k"><div class="muted">Expense Records</div><strong>${summary.expense_records_total || 0}</strong></div>
            <div class="k"><div class="muted">Teacher Salaries</div><strong>${summary.teacher_salaries_total || 0}</strong></div>
          </div>

          <h3>Payments</h3>
          <table>
            <thead>
              <tr><th>ID</th><th>Student</th><th>Type</th><th>Amount</th><th>Date</th></tr>
            </thead>
            <tbody>${paymentsRows || '<tr><td colspan="5">No payment data found.</td></tr>'}</tbody>
          </table>

          <h3>Expenses</h3>
          <table>
            <thead>
              <tr><th>ID</th><th>Category</th><th>Amount</th><th>Date</th><th>Paid By</th></tr>
            </thead>
            <tbody>${expensesRows || '<tr><td colspan="5">No expense data found.</td></tr>'}</tbody>
          </table>

          <h3>Teacher Salaries</h3>
          <table>
            <thead>
              <tr><th>ID</th><th>Teacher</th><th>Department</th><th>Amount</th><th>Date</th></tr>
            </thead>
            <tbody>${salaryRows || '<tr><td colspan="5">No salary data found.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `;
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Reports</h2>
          <p>
            {activeTab === "summary"
              ? "Revenue, expenses, and profit with flexible date ranges."
              : activeTab === "classMonth"
                ? "Per-class monthly, uniform, and transport fees with paid amounts for one Shamsi month."
                : activeTab === "studentStatement"
                  ? "A printable statement for one student, with payments, fees, and balances."
                  : activeTab === "expenseStatement"
                    ? "Excel-style expense category report: item, quantity, amount, bill number, and notes."
                  : activeTab === "teacherStatement"
                    ? "A printable salary statement for one teacher, with monthly salary payouts and balance."
                  : activeTab === "teacherSalaryList"
                    ? "Excel-style staff salary matrix for the year: months and totals."
                  : activeTab === "studentPaymentList"
                    ? "Excel-style student payments by month for selected fee types, with student and grand totals."
                  : "Receipt appearance for printed bills."}
          </p>
        </div>
        {activeTab === "summary" ? (
          <button className="button button-primary" onClick={fetchReport} disabled={loadingReport}>
            {loadingReport ? "Generating..." : "Generate Report"}
          </button>
        ) : activeTab === "classMonth" ? (
          <button className="button button-primary" onClick={fetchClassMonthReport} disabled={loadingClassMonth}>
            {loadingClassMonth ? "Generating..." : "Generate Report"}
          </button>
        ) : activeTab === "studentStatement" ? (
          <button className="button button-primary" onClick={loadStudentStatement} disabled={loadingStudentStatement}>
            {loadingStudentStatement ? "Generating..." : "Generate Statement"}
          </button>
        ) : activeTab === "expenseStatement" ? (
          <button className="button button-primary" onClick={loadExpenseStatement} disabled={loadingExpenseStatement}>
            {loadingExpenseStatement ? "Generating..." : "Generate Statement"}
          </button>
        ) : activeTab === "teacherStatement" ? (
          <button className="button button-primary" onClick={loadTeacherStatement} disabled={loadingTeacherStatement}>
            {loadingTeacherStatement ? "Generating..." : "Generate Statement"}
          </button>
        ) : activeTab === "teacherSalaryList" ? (
          <button
            className="button button-primary"
            onClick={loadTeacherSalaryList}
            disabled={loadingTeacherSalaryList}
          >
            {loadingTeacherSalaryList ? "Generating..." : "Generate Report"}
          </button>
        ) : activeTab === "studentPaymentList" ? (
          <button
            className="button button-primary"
            onClick={loadStudentPaymentList}
            disabled={loadingStudentPaymentList}
          >
            {loadingStudentPaymentList ? "Generating..." : "Generate Report"}
          </button>
        ) : (
          <button className="button button-primary" onClick={saveTemplate} disabled={savingTemplate}>
            {savingTemplate ? "Saving..." : "Save Template"}
          </button>
        )}
      </div>

      <div className="inline-actions">
        <button
          className={activeTab === "summary" ? "button button-primary" : "button button-outline"}
          type="button"
          onClick={() => setActiveTab("summary")}
        >
          Summary Report
        </button>
        <button
          className={activeTab === "classMonth" ? "button button-primary" : "button button-outline"}
          type="button"
          onClick={() => setActiveTab("classMonth")}
        >
          Class monthly fees
        </button>
        <button
          className={activeTab === "studentStatement" ? "button button-primary" : "button button-outline"}
          type="button"
          onClick={() => setActiveTab("studentStatement")}
        >
          Student statement
        </button>
        <button
          className={activeTab === "expenseStatement" ? "button button-primary" : "button button-outline"}
          type="button"
          onClick={() => {
            setActiveTab("expenseStatement");
            if (!expenseCategories.length) {
              void loadExpenseCategories();
            }
          }}
        >
          Expense statement
        </button>
        <button
          className={activeTab === "teacherStatement" ? "button button-primary" : "button button-outline"}
          type="button"
          onClick={() => setActiveTab("teacherStatement")}
        >
          Teacher statement
        </button>
        <button
          className={activeTab === "teacherSalaryList" ? "button button-primary" : "button button-outline"}
          type="button"
          onClick={() => setActiveTab("teacherSalaryList")}
        >
          Teacher salary list
        </button>
        <button
          className={activeTab === "studentPaymentList" ? "button button-primary" : "button button-outline"}
          type="button"
          onClick={() => {
            setActiveTab("studentPaymentList");
            if (!reportClasses.length) {
              void loadReportClasses();
            }
          }}
        >
          Student payment list
        </button>
        <button
          className={activeTab === "template" ? "button button-primary" : "button button-outline"}
          type="button"
          onClick={() => setActiveTab("template")}
        >
          Receipt Template
        </button>
      </div>

      {activeTab === "summary" && summary ? (
        <div className="inline-actions">
          <button className="button button-outline" type="button" onClick={exportReportCsv}>
            Export CSV
          </button>
          <button className="button button-outline" type="button" onClick={exportReportPdf}>
            Export PDF
          </button>
        </div>
      ) : null}

      {activeTab === "classMonth" && classMonthReport?.classes ? (
        <div className="inline-actions">
          <button className="button button-outline" type="button" onClick={exportClassMonthCsv}>
            Export CSV
          </button>
          <button className="button button-outline" type="button" onClick={printClassMonthReport}>
            Print
          </button>
        </div>
      ) : null}

      {activeTab === "studentStatement" && studentStatement ? (
        <div className="inline-actions">
          <button className="button button-outline" type="button" onClick={exportStudentStatementCsv}>
            Export CSV
          </button>
          <button className="button button-outline" type="button" onClick={printStudentStatement}>
            Print
          </button>
        </div>
      ) : null}

      {activeTab === "expenseStatement" && expenseStatement ? (
        <div className="inline-actions">
          <button
            className="button button-outline"
            type="button"
            onClick={exportExpenseStatementExcel}
            disabled={exportingExpenseExcel}
          >
            {exportingExpenseExcel ? "Exporting..." : "Export Excel"}
          </button>
          <button className="button button-outline" type="button" onClick={printExpenseStatement}>
            Print
          </button>
        </div>
      ) : null}

      {activeTab === "teacherStatement" && teacherStatement ? (
        <div className="inline-actions">
          <button className="button button-outline" type="button" onClick={exportTeacherStatementCsv}>
            Export CSV
          </button>
          <button className="button button-outline" type="button" onClick={printTeacherStatement}>
            Print
          </button>
        </div>
      ) : null}

      {activeTab === "teacherSalaryList" && teacherSalaryList ? (
        <div className="inline-actions">
          <button
            className="button button-outline"
            type="button"
            onClick={exportTeacherSalaryListExcel}
            disabled={exportingTeacherSalaryExcel}
          >
            {exportingTeacherSalaryExcel ? "Exporting..." : "Export Excel"}
          </button>
          <button className="button button-outline" type="button" onClick={printTeacherSalaryList}>
            Print
          </button>
        </div>
      ) : null}

      {activeTab === "studentPaymentList" && studentPaymentList ? (
        <div className="inline-actions">
          <button
            className="button button-outline"
            type="button"
            onClick={exportStudentPaymentListExcel}
            disabled={exportingStudentPaymentExcel}
          >
            {exportingStudentPaymentExcel ? "Exporting..." : "Export Excel"}
          </button>
          <button className="button button-outline" type="button" onClick={printStudentPaymentList}>
            Print
          </button>
        </div>
      ) : null}

      {activeTab === "summary" ? (
        <>
      <div className="panel">
        <div className="form-grid">
          <Field label="Period">
            <select className="input" value={filters.period} onChange={onChange("period")}>
              <option value="day">Day</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="custom">Custom</option>
            </select>
          </Field>
          {filters.period === "custom" ? (
            <>
              <Field label="Start (Shamsi YYYY-MM-DD)">
                <input className="input" value={filters.start} onChange={onChange("start")} />
              </Field>
              <Field label="End (Shamsi YYYY-MM-DD)">
                <input className="input" value={filters.end} onChange={onChange("end")} />
              </Field>
            </>
          ) : (
            <Field label="Date (Shamsi)">
              <input
                className="input"
                value={filters.date}
                onChange={onChange("date")}
                placeholder={filters.period === "day" ? "1404-01-10" : filters.period === "month" ? "1404-01" : "1404"}
              />
            </Field>
          )}
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={filters.includeItems}
              onChange={onChange("includeItems")}
            />
            Include items
          </label>
        </div>
        {loadingReport ? <div className="status-message">Generating report...</div> : null}
        {error ? <div className="form-error">{error}</div> : null}
      </div>

      <div className="stats-grid">
        <StatCard label="Total Revenue" value={summary ? summary.total_revenue : "—"} />
        <StatCard label="Total Expenses" value={summary ? summary.total_expenses : "—"} />
        <StatCard label="Teacher Salaries" value={summary ? summary.teacher_salaries_total ?? "—" : "—"} />
        <StatCard label="Other Expenses" value={summary ? summary.expense_records_total ?? "—" : "—"} />
        <StatCard label="Profit" value={summary ? summary.profit : "—"} />
      </div>

      {summary?.payments ? (
        <div className="panel">
          <h3>Payment Details</h3>
          {summary.payments.length > 0 ? (
            <div className="table">
              <div className="table-head">
                <div>ID</div>
                <div>Student</div>
                <div>Type</div>
                <div>Amount</div>
                <div>Date</div>
              </div>
              {summary.payments.map((payment) => (
                <div className="table-row" key={payment.id}>
                  <div>{payment.id}</div>
                  <div>{payment.student_name || payment.student}</div>
                  <div>{payment.fee_type_name || payment.fee_type}</div>
                  <div>{payment.amount}</div>
                  <div>{payment.date_shamsi}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted-panel">No payment data found for this filter.</div>
          )}
        </div>
      ) : null}

      {summary?.expenses ? (
        <div className="panel">
          <h3>Expense Details</h3>
          {summary.expenses.length > 0 ? (
            <div className="table">
              <div className="table-head">
                <div>ID</div>
                <div>Category</div>
                <div>Amount</div>
                <div>Date</div>
                <div>Paid By</div>
              </div>
              {summary.expenses.map((expense) => (
                <div className="table-row" key={expense.id}>
                  <div>{expense.id}</div>
                  <div>{expense.category_name || expense.category}</div>
                  <div>{expense.amount}</div>
                  <div>{expense.date_shamsi}</div>
                  <div>{expense.paid_by}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted-panel">No expense data found for this filter.</div>
          )}
        </div>
      ) : null}

      {summary?.teacher_salary_payments ? (
        <div className="panel">
          <h3>Teacher Salary Details</h3>
          {summary.teacher_salary_payments.length > 0 ? (
            <div className="table">
              <div className="table-head">
                <div>ID</div>
                <div>Teacher</div>
                <div>Department</div>
                <div>Amount</div>
                <div>Date</div>
              </div>
              {summary.teacher_salary_payments.map((payment) => (
                <div className="table-row" key={payment.id}>
                  <div>{payment.id}</div>
                  <div>{payment.teacher_name || payment.teacher}</div>
                  <div>{payment.teacher_department || "—"}</div>
                  <div>{payment.amount}</div>
                  <div>{payment.date_shamsi}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted-panel">No teacher salary data found for this filter.</div>
          )}
        </div>
      ) : null}
      </>
      ) : null}

      {activeTab === "classMonth" ? (
        <>
          <div className="panel">
            <h3>Class monthly fees</h3>
            <p className="muted-panel" style={{ marginBottom: 12 }}>
              Select a Shamsi month (YYYY-MM). Columns are grouped: fee then paid for Monthly, Uniform, and Transport,
              then Total fees and Total paid. Monthly/transport are for that month; uniform is one-time (paid through
              that month).
            </p>
            <div className="form-grid">
              <Field label="Shamsi month (YYYY-MM)">
                <input
                  className="input"
                  value={classMonthShamsi}
                  onChange={(event) => setClassMonthShamsi(event.target.value)}
                  placeholder="1404-01"
                />
              </Field>
            </div>
            {loadingClassMonth ? <div className="status-message">Generating report...</div> : null}
            {classMonthError ? <div className="form-error">{classMonthError}</div> : null}
          </div>

          {classMonthReport?.classes?.length ? (
            <div className="panel" style={{ overflowX: "auto" }}>
              <h3>Results — {classMonthReport.month_shamsi}</h3>
              <div className="table">
                <div className="table-head" style={classFeesGridStyle}>
                  <div>Class</div>
                  <div>Students</div>
                  <div>Monthly fees</div>
                  <div>Monthly paid</div>
                  <div>Uniform fees</div>
                  <div>Uniform paid</div>
                  <div>Transport fees</div>
                  <div>Transport paid</div>
                  <div>Total fees</div>
                  <div>Total paid</div>
                  <div>Free</div>
                </div>
                {classMonthReport.classes.map((row) => (
                  <div className="table-row" key={row.class_id} style={classFeesGridStyle}>
                    <div>{row.class_label}</div>
                    <div>{row.student_count}</div>
                    <div>{row.total_monthly_expected}</div>
                    <div>{row.total_monthly_paid}</div>
                    <div>{row.total_uniform_expected}</div>
                    <div>{row.total_uniform_paid}</div>
                    <div>{row.total_transport_expected}</div>
                    <div>{row.total_transport_paid}</div>
                    <div>
                      <strong>{row.total_expected}</strong>
                    </div>
                    <div>
                      <strong>{row.total_paid}</strong>
                    </div>
                    <div>{row.free_students_count}</div>
                  </div>
                ))}
                <div
                  className="table-row"
                  style={{
                    ...classFeesGridStyle,
                    fontWeight: 700,
                    background: "rgba(15, 23, 42, 0.04)",
                    borderTop: "2px solid rgba(15, 23, 42, 0.12)",
                  }}
                >
                  <div>TOTAL</div>
                  <div>{classMonthTotals.student_count}</div>
                  <div>{classMonthTotals.total_monthly_expected}</div>
                  <div>{classMonthTotals.total_monthly_paid}</div>
                  <div>{classMonthTotals.total_uniform_expected}</div>
                  <div>{classMonthTotals.total_uniform_paid}</div>
                  <div>{classMonthTotals.total_transport_expected}</div>
                  <div>{classMonthTotals.total_transport_paid}</div>
                  <div>{classMonthTotals.total_expected}</div>
                  <div>{classMonthTotals.total_paid}</div>
                  <div>{classMonthTotals.free_students_count}</div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {activeTab === "studentStatement" ? (
        <>
          <div className="panel">
            <h3>Student search</h3>
            <div className="inline-actions">
              <input
                className="input"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Name, registration number, father, grandfather, phone..."
              />
              <button className="button button-outline" type="button" onClick={() => searchStudents(1)} disabled={loadingStudentSearch}>
                {loadingStudentSearch ? "Searching..." : "Search"}
              </button>
            </div>
            <div className="pill-list">
              {students.map((student) => (
                <button
                  key={student.id}
                  className={`pill ${selectedStudent?.id === student.id ? "pill-active" : ""}`}
                  onClick={() => setSelectedStudent(student)}
                  type="button"
                >
                  {student.name} ({student.registration_number || "No Reg"}) - {student.father_name}
                </button>
              ))}
            </div>
            {!loadingStudentSearch && students.length === 0 ? (
              <div className="muted-panel" style={{ marginTop: 12 }}>
                Search for a student to build the statement.
              </div>
            ) : null}
            <PaginationControls
              count={studentsMeta.count}
              currentPage={studentsPage}
              pageSize={studentSearchPageSize}
              hasPrevious={Boolean(studentsMeta.previous)}
              hasNext={Boolean(studentsMeta.next)}
              onPrevious={() => searchStudents(Math.max(1, studentsPage - 1))}
              onNext={() => searchStudents(studentsPage + 1)}
            />
          </div>

          <div className="panel">
            <h3>Statement options</h3>
            <p className="muted-panel" style={{ marginBottom: 12 }}>
              Leave the month blank to use the current Shamsi month. The report includes monthly fees, transport,
              one-time uniform/book items, and the full payment ledger.
            </p>
            <div className="form-grid">
              <Field label="Selected Student">
                <input
                  className="input"
                  value={
                    selectedStudent
                      ? `${selectedStudent.name} (${selectedStudent.registration_number || "No Reg"})`
                      : ""
                  }
                  readOnly
                  placeholder="Choose a student above"
                />
              </Field>
              <Field label="Through Month (Shamsi YYYY-MM, optional)">
                <input
                  className="input"
                  value={studentStatementMonth}
                  onChange={(event) => setStudentStatementMonth(event.target.value)}
                  placeholder="Current month if blank"
                />
              </Field>
            </div>
            {loadingStudentStatement ? <div className="status-message">Generating statement...</div> : null}
            {studentStatementError ? <div className="form-error">{studentStatementError}</div> : null}
            {studentStatement ? (
              <div className="muted-panel" style={{ marginTop: 12 }}>
                This view is the readable version. Use <strong>Print</strong> for the signable office copy.
              </div>
            ) : null}
          </div>

          {studentStatement ? (
            <>
              <div className="stats-grid">
                <StatCard label="Total Should Pay" value={studentStatement.summary?.total_expected || "—"} />
                <StatCard label="Total Paid" value={studentStatement.summary?.total_paid || "—"} />
                <StatCard label="Balance" value={studentStatement.summary?.total_balance || studentStatement.summary?.total_due || "—"} />
                <StatCard label="Statement Through" value={studentStatement.through_month_shamsi || "—"} />
              </div>

              <div className="panel">
                <h3>Student Details</h3>
                <p className="muted-panel" style={{ marginBottom: 12 }}>
                  Basic student information used in the statement.
                </p>
                <div className="table">
                  <div className="table-head">
                    <div>Field</div>
                    <div>Value</div>
                  </div>
                  <div className="table-row">
                    <div>Name</div>
                    <div>{studentStatement.student?.name}</div>
                  </div>
                  <div className="table-row">
                    <div>Registration No</div>
                    <div>{studentStatement.student?.registration_number}</div>
                  </div>
                  <div className="table-row">
                    <div>Class</div>
                    <div>
                      {studentStatement.student?.class_name} ({studentStatement.student?.class_year_shamsi})
                    </div>
                  </div>
                  <div className="table-row">
                    <div>Enrolled</div>
                    <div>{studentStatement.student?.enrolled_date_shamsi}</div>
                  </div>
                  <div className="table-row">
                    <div>Previous Balance</div>
                    <div>{studentStatement.student?.previous_balance}</div>
                  </div>
                  <div className="table-row">
                    <div>Through Month</div>
                    <div>{studentStatement.through_month_shamsi}</div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <h3>Fee Summary</h3>
                <p className="muted-panel" style={{ marginBottom: 12 }}>
                  Expected = charged amount. Paid = recorded payments. Due = remaining balance.
                </p>
                <div className="table">
                  <div className="table-head">
                    <div>Type</div>
                    <div>Expected</div>
                    <div>Paid</div>
                    <div>Due</div>
                  </div>
                  <div className="table-row">
                    <div>Monthly</div>
                    <div>{studentStatement.summary?.monthly_expected}</div>
                    <div>{studentStatement.summary?.monthly_paid}</div>
                    <div>{studentStatement.summary?.monthly_due}</div>
                  </div>
                  <div className="table-row">
                    <div>Transport</div>
                    <div>{studentStatement.summary?.transport_expected}</div>
                    <div>{studentStatement.summary?.transport_paid}</div>
                    <div>{studentStatement.summary?.transport_due}</div>
                  </div>
                  <div className="table-row">
                    <div>Uniform</div>
                    <div>{studentStatement.summary?.uniform_expected}</div>
                    <div>{studentStatement.summary?.uniform_paid}</div>
                    <div>{studentStatement.summary?.uniform_due}</div>
                  </div>
                  <div className="table-row">
                    <div>Book</div>
                    <div>{studentStatement.summary?.book_expected}</div>
                    <div>{studentStatement.summary?.book_paid}</div>
                    <div>{studentStatement.summary?.book_due}</div>
                  </div>
                  <div className="table-row">
                    <div>Previous Balance</div>
                    <div>{studentStatement.summary?.previous_balance_expected}</div>
                    <div>{studentStatement.summary?.previous_balance_paid}</div>
                    <div>{studentStatement.summary?.previous_balance_due}</div>
                  </div>
                  <div className="table-row">
                    <div>Other</div>
                    <div>â€”</div>
                    <div>{studentStatement.summary?.other_paid}</div>
                    <div>â€”</div>
                  </div>
                </div>
              </div>

              <div className="panel" style={{ overflowX: "auto" }}>
                <h3>Monthly Breakdown</h3>
                <p className="muted-panel" style={{ marginBottom: 12 }}>
                  One row per month, showing recurring charges only.
                </p>
                <div className="table" style={{ minWidth: 980 }}>
                  <div className="table-head">
                    <div>Month</div>
                    <div>Exp. Monthly</div>
                    <div>Paid Monthly</div>
                    <div>Due Monthly</div>
                    <div>Exp. Transport</div>
                    <div>Paid Transport</div>
                    <div>Due Transport</div>
                    <div>Total Due</div>
                  </div>
                  {(studentStatement.months || []).map((row) => (
                    <div className="table-row" key={row.month_shamsi}>
                      <div>{row.month_shamsi}</div>
                      <div>{row.expected_monthly_fee}</div>
                      <div>{row.paid_monthly_fee}</div>
                      <div>{row.due_monthly_fee}</div>
                      <div>{row.expected_transport_fee}</div>
                      <div>{row.paid_transport_fee}</div>
                      <div>{row.due_transport_fee}</div>
                      <div>{row.total_due}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <h3>Payment Ledger</h3>
                <p className="muted-panel" style={{ marginBottom: 12 }}>
                  Every payment recorded for this student in the selected range.
                </p>
                <div className="table">
                  <div className="table-head">
                    <div>Bill</div>
                    <div>Fee Type</div>
                    <div>Amount</div>
                    <div>Date</div>
                    <div>Reason</div>
                    <div>Notes</div>
                  </div>
                  {(studentStatement.payments || []).map((payment) => (
                    <div className="table-row" key={payment.id}>
                      <div>{payment.bill_number}</div>
                      <div>{payment.fee_type_name || payment.fee_type}</div>
                      <div>{payment.amount}</div>
                      <div>{payment.date_shamsi}</div>
                      <div>{payment.other_reason || "â€”"}</div>
                      <div>{payment.notes || "â€”"}</div>
                    </div>
                  ))}
                </div>
                {!studentStatement.payments?.length ? (
                  <div className="muted-panel" style={{ marginTop: 12 }}>
                    No payments found for this statement range.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {activeTab === "expenseStatement" ? (
        <>
          <div className="panel">
            <h3>Statement options</h3>
            <p className="muted-panel" style={{ marginBottom: 12 }}>
              Leave category empty to include <strong>all categories</strong>. Select one category for a single
              section. Same item names are merged and bill numbers are combined (e.g. 810/1379).
            </p>
            <div className="form-grid">
              <Field label="Expense Category (optional)">
                <select
                  className="input"
                  value={selectedExpenseCategoryId}
                  onChange={(event) => setSelectedExpenseCategoryId(event.target.value)}
                >
                  <option value="">All categories</option>
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Start (Shamsi YYYY-MM-DD, optional)">
                <input
                  className="input"
                  value={expenseStatementStart}
                  onChange={(event) => setExpenseStatementStart(event.target.value)}
                  placeholder="1404-01-01"
                />
              </Field>
              <Field label="End (Shamsi YYYY-MM-DD, optional)">
                <input
                  className="input"
                  value={expenseStatementEnd}
                  onChange={(event) => setExpenseStatementEnd(event.target.value)}
                  placeholder="1404-12-29"
                />
              </Field>
            </div>
            {loadingExpenseStatement ? <div className="status-message">Generating statement...</div> : null}
            {expenseStatementError ? <div className="form-error">{expenseStatementError}</div> : null}
          </div>

          {expenseStatement ? (
            <>
              <div className="stats-grid">
                <StatCard
                  label="Category"
                  value={
                    expenseStatement.filters?.all_categories
                      ? "All categories"
                      : expenseStatement.category?.name || "—"
                  }
                />
                <StatCard label="Total Amount" value={expenseStatement.summary?.total_amount || "—"} />
                <StatCard label="Categories" value={expenseStatement.summary?.categories_count || "—"} />
                <StatCard label="Expense Rows" value={expenseStatement.summary?.expenses_count || "—"} />
              </div>

              {(expenseStatement.sections || []).map((section) => (
                <div className="panel" key={section.category?.id || section.category?.name}>
                  <div className="expense-sheet-wrap">
                    <table className="expense-sheet">
                      <caption>{section.category?.name || "مصارف"}</caption>
                      <thead>
                        <tr>
                          <th className="col-no">شماره</th>
                          <th>اسم جنس</th>
                          <th className="col-qty">تعداد</th>
                          <th className="col-amount">مقدار مصرف</th>
                          <th className="col-bill">نمبر بل</th>
                          <th>ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(section.items || []).map((item) => (
                          <tr key={`${section.category?.id}-${item.row_number}-${item.item_name || "row"}`}>
                            <td>{item.row_number}</td>
                            <td className="item-name">{item.item_name || "—"}</td>
                            <td>{item.quantity || "—"}</td>
                            <td>{item.amount}</td>
                            <td>{item.bill_number || "—"}</td>
                            <td className="notes">{item.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td></td>
                          <td className="item-name">جمله شد بل</td>
                          <td></td>
                          <td>{section.summary?.total_amount}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {!section.items?.length ? (
                    <div className="muted-panel" style={{ marginTop: 12 }}>
                      No expense rows found for this category.
                    </div>
                  ) : null}
                </div>
              ))}

              {(expenseStatement.sections || []).length > 1 ? (
                <div className="expense-grand-total">مجموعه کل: {expenseStatement.summary?.total_amount}</div>
              ) : null}

              {!expenseStatement.sections?.length ? (
                <div className="muted-panel">No expense rows found for this statement range.</div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {activeTab === "teacherStatement" ? (
        <>
          <div className="panel">
            <h3>Teacher search</h3>
            <div className="inline-actions">
              <input
                className="input"
                value={teacherSearch}
                onChange={(event) => setTeacherSearch(event.target.value)}
                placeholder="Name, father, phone, department..."
              />
              <button className="button button-outline" type="button" onClick={() => searchTeachers(1)} disabled={loadingTeacherSearch}>
                {loadingTeacherSearch ? "Searching..." : "Search"}
              </button>
            </div>
            <div className="pill-list">
              {teachers.map((teacher) => (
                <button
                  key={teacher.id}
                  className={`pill ${selectedTeacher?.id === teacher.id ? "pill-active" : ""}`}
                  onClick={() => onSelectTeacher(teacher)}
                  type="button"
                >
                  {teacher.name} - {teacher.department}
                </button>
              ))}
            </div>
            {!loadingTeacherSearch && teachers.length === 0 ? (
              <div className="muted-panel" style={{ marginTop: 12 }}>
                Search for a teacher to build the statement.
              </div>
            ) : null}
            <PaginationControls
              count={teachersMeta.count}
              currentPage={teachersPage}
              pageSize={teacherSearchPageSize}
              hasPrevious={Boolean(teachersMeta.previous)}
              hasNext={Boolean(teachersMeta.next)}
              onPrevious={() => searchTeachers(Math.max(1, teachersPage - 1))}
              onNext={() => searchTeachers(teachersPage + 1)}
            />
          </div>

          <div className="panel">
            <h3>Statement options</h3>
            <p className="muted-panel" style={{ marginBottom: 12 }}>
              Leave the month blank to use the current Shamsi month. The report shows monthly salary due, salary
              payments, and the remaining balance.
            </p>
            <div className="form-grid">
              <Field label="Selected Teacher">
                <input
                  className="input"
                  value={
                    selectedTeacher
                      ? `${selectedTeacher.name} (${selectedTeacher.department || "No Department"})`
                      : ""
                  }
                  readOnly
                  placeholder="Choose a teacher above"
                />
              </Field>
              <Field label="Through Month (Shamsi YYYY-MM, optional)">
                <input
                  className="input"
                  value={teacherStatementMonth}
                  onChange={(event) => setTeacherStatementMonth(event.target.value)}
                  placeholder="Current month if blank"
                />
              </Field>
            </div>
            {loadingTeacherStatement ? <div className="status-message">Generating statement...</div> : null}
            {teacherStatementError ? <div className="form-error">{teacherStatementError}</div> : null}
            {teacherStatement ? (
              <div className="muted-panel" style={{ marginTop: 12 }}>
                This view is the readable version. Use <strong>Print</strong> for the signable office copy.
              </div>
            ) : null}
          </div>

          {teacherStatement ? (
            <>
              <div className="stats-grid">
                <StatCard label="Total Should Pay" value={teacherStatement.summary?.total_expected || "—"} />
                <StatCard label="Total Paid" value={teacherStatement.summary?.total_paid || "—"} />
                <StatCard label="Balance" value={teacherStatement.summary?.total_balance || teacherStatement.summary?.total_due || "—"} />
                <StatCard label="Statement Through" value={teacherStatement.through_month_shamsi || "—"} />
              </div>

              <div className="panel">
                <h3>Teacher Details</h3>
                <p className="muted-panel" style={{ marginBottom: 12 }}>
                  Basic teacher information used in the statement.
                </p>
                <div className="table">
                  <div className="table-head">
                    <div>Field</div>
                    <div>Value</div>
                  </div>
                  <div className="table-row">
                    <div>Name</div>
                    <div>{teacherStatement.teacher?.name}</div>
                  </div>
                  <div className="table-row">
                    <div>Department</div>
                    <div>{teacherStatement.teacher?.department}</div>
                  </div>
                  <div className="table-row">
                    <div>Phone</div>
                    <div>{teacherStatement.teacher?.phone}</div>
                  </div>
                  <div className="table-row">
                    <div>Monthly Salary</div>
                    <div>{teacherStatement.teacher?.salary}</div>
                  </div>
                  <div className="table-row">
                    <div>Statement Through</div>
                    <div>{teacherStatement.through_month_shamsi}</div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <h3>Salary Summary</h3>
                <p className="muted-panel" style={{ marginBottom: 12 }}>
                  Expected = salary for each month. Paid = recorded salary payments. Due = remaining balance.
                </p>
                <div className="table">
                  <div className="table-head">
                    <div>Type</div>
                    <div>Expected</div>
                    <div>Paid</div>
                    <div>Due</div>
                  </div>
                  <div className="table-row">
                    <div>Monthly Salary</div>
                    <div>{teacherStatement.summary?.total_expected}</div>
                    <div>{teacherStatement.summary?.total_paid}</div>
                    <div>{teacherStatement.summary?.total_balance || teacherStatement.summary?.total_due}</div>
                  </div>
                </div>
              </div>

              <div className="panel" style={{ overflowX: "auto" }}>
                <h3>Monthly Breakdown</h3>
                <p className="muted-panel" style={{ marginBottom: 12 }}>
                  One row per month, showing salary due and salary payments.
                </p>
                <div className="table" style={{ minWidth: 760 }}>
                  <div className="table-head">
                    <div>Month</div>
                    <div>Expected Salary</div>
                    <div>Paid Salary</div>
                    <div>Due Salary</div>
                  </div>
                  {(teacherStatement.months || []).map((row) => (
                    <div className="table-row" key={row.month_shamsi}>
                      <div>{row.month_shamsi}</div>
                      <div>{row.expected_salary}</div>
                      <div>{row.paid_salary}</div>
                      <div>{row.due_salary}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <h3>Salary Payments</h3>
                <p className="muted-panel" style={{ marginBottom: 12 }}>
                  Every salary payment recorded for this teacher in the selected range.
                </p>
                <div className="table">
                  <div className="table-head">
                    <div>Date</div>
                    <div>Amount</div>
                    <div>Notes</div>
                  </div>
                  {(teacherStatement.salary_payments || []).map((payment) => (
                    <div className="table-row" key={payment.id}>
                      <div>{payment.date_shamsi}</div>
                      <div>{payment.amount}</div>
                      <div>{payment.notes || "—"}</div>
                    </div>
                  ))}
                </div>
                {!teacherStatement.salary_payments?.length ? (
                  <div className="muted-panel" style={{ marginTop: 12 }}>
                    No salary payments found for this statement range.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {activeTab === "teacherSalaryList" ? (
        <>
          <div className="panel">
            <h3>Salary list options</h3>
            <p className="muted-panel" style={{ marginBottom: 12 }}>
              Same layout as the Excel <strong>لیست معاشات</strong>: all teachers and each month’s salary.
              Unpaid months show <strong>//</strong>.
            </p>
            <div className="form-grid">
              <Field label="Shamsi Year (YYYY, optional)">
                <input
                  className="input"
                  value={teacherSalaryYear}
                  onChange={(event) => setTeacherSalaryYear(event.target.value)}
                  placeholder="1404"
                />
              </Field>
            </div>
            {loadingTeacherSalaryList ? <div className="status-message">Generating salary list...</div> : null}
            {teacherSalaryError ? <div className="form-error">{teacherSalaryError}</div> : null}
          </div>

          {teacherSalaryList ? (
            <>
              <div className="stats-grid">
                <StatCard label="Year" value={teacherSalaryList.year_shamsi || "—"} />
                <StatCard label="Teachers" value={teacherSalaryList.summary?.teachers_count || "—"} />
                <StatCard label="Total Salaries" value={teacherSalaryList.summary?.total_salary || "—"} />
              </div>

              <div className="panel">
                <h3>لیست معاشات پرسونل — سال {teacherSalaryList.year_shamsi}</h3>
                <div className="salary-sheet-wrap">
                  <table className="salary-sheet">
                    <thead>
                      <tr>
                        <th className="sticky-col col-no">شماره</th>
                        <th className="sticky-col col-name">اسم</th>
                        <th className="sticky-col col-father">ولد</th>
                        <th className="sticky-col col-role">وظیفه</th>
                        {(teacherSalaryList.month_labels || []).map((month) => (
                          <th key={month.month_shamsi}>{month.label}</th>
                        ))}
                        <th>مجموعه ماه</th>
                        <th>مجموعه معاش</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(teacherSalaryList.rows || []).map((row) => (
                        <tr key={row.teacher_id}>
                          <td className="sticky-col col-no">{row.row_number}</td>
                          <td className="sticky-col col-name">{row.name}</td>
                          <td className="sticky-col col-father">{row.father_name}</td>
                          <td className="sticky-col col-role">{row.department}</td>
                          {(row.months || []).map((month) => (
                            <td key={`${row.teacher_id}-${month.month_shamsi}`}>{month.paid_display}</td>
                          ))}
                          <td>{row.months_paid_count}</td>
                          <td>{row.total_salary}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4}>مجموعه</td>
                        {(teacherSalaryList.summary?.month_totals || []).map((month) => (
                          <td key={`total-${month.month_shamsi}`}>{month.salary}</td>
                        ))}
                        <td></td>
                        <td>{teacherSalaryList.summary?.total_salary}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {!teacherSalaryList.rows?.length ? (
                  <div className="muted-panel" style={{ marginTop: 12 }}>
                    No teachers found.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {activeTab === "studentPaymentList" ? (
        <>
          <div className="panel">
            <h3>Student payment list options</h3>
            <p className="muted-panel" style={{ marginBottom: 12 }}>
              Choose fee types (monthly, transport, uniform, book). The report shows each month from Hamal to Hoot.
              With amounts: paid cells show the value and empty months show <strong>//</strong>.
              With status only: paid shows <strong>✓</strong> and unpaid shows <strong>✗</strong> (no amounts — good for teachers).
            </p>
            <div className="form-grid">
              <Field label="Shamsi Year (YYYY, optional)">
                <input
                  className="input"
                  value={studentPaymentYear}
                  onChange={(event) => setStudentPaymentYear(event.target.value)}
                  placeholder="1404"
                />
              </Field>
              <Field label="Class (optional)">
                <select
                  className="input"
                  value={studentPaymentClassId}
                  onChange={(event) => setStudentPaymentClassId(event.target.value)}
                >
                  <option value="">All classes</option>
                  {reportClasses.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.name} ({schoolClass.year_shamsi})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="muted-panel" style={{ marginBottom: 8 }}>
                Fee categories
              </div>
              <div className="category-checkboxes">
                {[
                  ["monthly", "Monthly fees"],
                  ["transport", "Transport"],
                  ["uniform", "Uniform"],
                  ["book", "Book"],
                ].map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={Boolean(studentPaymentCategories[key])}
                      onChange={(event) =>
                        setStudentPaymentCategories((prev) => ({
                          ...prev,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 14 }} className="category-checkboxes">
              <label>
                <input
                  type="checkbox"
                  checked={studentPaymentStatusOnly}
                  onChange={(event) => setStudentPaymentStatusOnly(event.target.checked)}
                />
                Status only for teachers (hide amounts — show ✓ / ✗)
              </label>
            </div>
            {loadingStudentPaymentList ? <div className="status-message">Generating payment list...</div> : null}
            {studentPaymentError ? <div className="form-error">{studentPaymentError}</div> : null}
          </div>

          {studentPaymentList ? (
            <>
              <div className="stats-grid">
                <StatCard label="Year" value={studentPaymentList.year_shamsi || "—"} />
                <StatCard label="Students" value={studentPaymentList.summary?.students_count || "—"} />
                {studentPaymentStatusOnly ? (
                  <StatCard label="View" value="✓ / ✗ status" />
                ) : (
                  <StatCard label="Grand Total" value={studentPaymentList.summary?.grand_total || "—"} />
                )}
                <StatCard
                  label="Categories"
                  value={(studentPaymentList.categories || []).map((item) => item.label).join("، ") || "—"}
                />
              </div>

              <div className="panel">
                <h3>
                  {studentPaymentStatusOnly ? "وضعیت پرداخت شاگردان" : "لیست پرداخت‌های شاگردان"} — سال{" "}
                  {studentPaymentList.year_shamsi}
                  {studentPaymentStatusOnly ? " (✓ پرداخت شده / ✗ نپرداخته)" : ""}
                </h3>
                <div className="salary-sheet-wrap">
                  <table className="salary-sheet">
                    <thead>
                      <tr>
                        <th rowSpan={2}>شماره</th>
                        <th rowSpan={2}>اسم</th>
                        <th rowSpan={2}>نمبر ثبت</th>
                        <th rowSpan={2}>ولد</th>
                        <th rowSpan={2}>صنف</th>
                        {(studentPaymentList.month_labels || []).map((month) => (
                          <th
                            key={month.month_shamsi}
                            colSpan={
                              (studentPaymentList.categories || []).length + (studentPaymentStatusOnly ? 0 : 1)
                            }
                          >
                            {month.label}
                          </th>
                        ))}
                        {!studentPaymentStatusOnly
                          ? (studentPaymentList.categories || []).map((category) => (
                              <th key={`total-head-${category.key}`} rowSpan={2}>
                                مجموعه {category.label}
                              </th>
                            ))
                          : null}
                        {!studentPaymentStatusOnly ? <th rowSpan={2}>مجموعه شاگرد</th> : null}
                      </tr>
                      <tr>
                        {(studentPaymentList.month_labels || []).map((month) => (
                          <Fragment key={`sub-${month.month_shamsi}`}>
                            {(studentPaymentList.categories || []).map((category) => (
                              <th key={`${month.month_shamsi}-${category.key}`}>{category.label}</th>
                            ))}
                            {!studentPaymentStatusOnly ? <th>جمع ماه</th> : null}
                          </Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(studentPaymentList.rows || []).map((row) => (
                        <tr key={row.student_id}>
                          <td>{row.row_number}</td>
                          <td>{row.name}</td>
                          <td>{row.registration_number}</td>
                          <td>{row.father_name}</td>
                          <td>{row.class_name}</td>
                          {(row.months || []).map((month) => (
                            <Fragment key={`${row.student_id}-${month.month_shamsi}`}>
                              {(studentPaymentList.categories || []).map((category) => {
                                const value = studentPaymentCellValue(month, category.key);
                                const paid = isStudentCategoryPaid(month, category.key);
                                return (
                                  <td
                                    key={`${month.month_shamsi}-${category.key}`}
                                    className={
                                      studentPaymentStatusOnly
                                        ? paid
                                          ? "pay-status-ok"
                                          : "pay-status-no"
                                        : undefined
                                    }
                                  >
                                    {value}
                                  </td>
                                );
                              })}
                              {!studentPaymentStatusOnly ? <td>{month.month_total}</td> : null}
                            </Fragment>
                          ))}
                          {!studentPaymentStatusOnly
                            ? (studentPaymentList.categories || []).map((category) => (
                                <td key={`ct-${row.student_id}-${category.key}`}>
                                  {row.category_totals?.[category.key] || "0.00"}
                                </td>
                              ))
                            : null}
                          {!studentPaymentStatusOnly ? <td>{row.subtotal}</td> : null}
                        </tr>
                      ))}
                    </tbody>
                    {!studentPaymentStatusOnly ? (
                      <tfoot>
                        <tr>
                          <td colSpan={5}>مجموعه نهایی</td>
                          {(studentPaymentList.summary?.month_totals || []).map((month) => (
                            <Fragment key={`ft-${month.month_shamsi}`}>
                              {(studentPaymentList.categories || []).map((category) => (
                                <td key={`ft-${month.month_shamsi}-${category.key}`}>
                                  {month.amounts?.[category.key] || "0.00"}
                                </td>
                              ))}
                              <td>{month.month_total}</td>
                            </Fragment>
                          ))}
                          {(studentPaymentList.categories || []).map((category) => (
                            <td key={`fct-${category.key}`}>
                              {studentPaymentList.summary?.category_totals?.[category.key] || "0.00"}
                            </td>
                          ))}
                          <td>{studentPaymentList.summary?.grand_total}</td>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
                {!studentPaymentList.rows?.length ? (
                  <div className="muted-panel" style={{ marginTop: 12 }}>
                    No students found.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {activeTab === "template" ? (
        <div className="panel">
          <h3>Receipt Template Settings</h3>
          <div className="form-grid">
            <Field label="School Name">
              <input className="input" value={template.schoolName} onChange={onTemplateChange("schoolName")} />
            </Field>
            <Field label="School Address">
              <input className="input" value={template.schoolAddress} onChange={onTemplateChange("schoolAddress")} />
            </Field>
            <Field label="School Phone">
              <input className="input" value={template.schoolPhone} onChange={onTemplateChange("schoolPhone")} />
            </Field>
            <Field label="Thank You Message">
              <input className="input" value={template.thankYouMessage} onChange={onTemplateChange("thankYouMessage")} />
            </Field>
            <Field label="Dari fees bill title (print)">
              <input className="input" value={template.dariBillTitle || ""} onChange={onTemplateChange("dariBillTitle")} dir="rtl" />
            </Field>
            <Field label="English fees bill line (print, optional)">
              <input
                className="input"
                value={template.englishFeesBillLine || ""}
                onChange={onTemplateChange("englishFeesBillLine")}
                placeholder={`${template.schoolName} FeesBill`}
              />
            </Field>
            <Field label="Dari bill footer note (print)">
              <textarea
                className="input"
                rows={3}
                value={template.dariBillFooterNote || ""}
                onChange={onTemplateChange("dariBillFooterNote")}
                dir="rtl"
              />
            </Field>
            <Field label="School Logo">
              <input className="input" type="file" accept="image/*" onChange={onLogoChange} />
            </Field>
            <div className="inline-actions">
              <button className="button button-outline" type="button" onClick={clearLogo}>
                Remove Logo
              </button>
              <button className="button button-primary" type="button" onClick={saveTemplate} disabled={savingTemplate}>
                {savingTemplate ? "Saving..." : "Save Template"}
              </button>
            </div>
          </div>

          {template.logoDataUrl ? (
            <div style={{ marginTop: 12 }}>
              <div className="field-label">Current Logo Preview</div>
              <img
                src={template.logoDataUrl}
                alt="Current logo"
                style={{ width: 96, height: 96, objectFit: "contain", marginTop: 6, border: "1px solid #e2e8f0", borderRadius: 12, padding: 6, background: "#fff" }}
              />
            </div>
          ) : null}

          {templateStatus ? <div className="form-error" style={{ color: "#065f46" }}>{templateStatus}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

