import { useState } from "react";
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
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [selectedExpenseCategoryId, setSelectedExpenseCategoryId] = useState("");
  const [expenseStatementStart, setExpenseStatementStart] = useState("");
  const [expenseStatementEnd, setExpenseStatementEnd] = useState("");
  const [expenseStatement, setExpenseStatement] = useState(null);
  const [expenseStatementError, setExpenseStatementError] = useState("");
  const [loadingExpenseStatement, setLoadingExpenseStatement] = useState(false);

  const classFeesGridStyle = {
    gridTemplateColumns: "minmax(150px, 1.3fr) 72px repeat(7, minmax(86px, 1fr)) 64px",
    minWidth: "920px",
  };
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
    if (!selectedExpenseCategoryId) {
      setExpenseStatementError("Select an expense category first.");
      return;
    }
    setExpenseStatementError("");
    setLoadingExpenseStatement(true);
    try {
      const params = new URLSearchParams({
        category_id: String(selectedExpenseCategoryId),
      });
      if (expenseStatementStart && expenseStatementEnd) {
        params.set("start", expenseStatementStart);
        params.set("end", expenseStatementEnd);
      }
      const data = await apiFetch(`/reports/expense-statement/?${params.toString()}`);
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
        "Monthly fees (total)",
        "Transport fees (total)",
        "Monthly paid",
        "Transport paid",
        "Monthly remaining",
        "Transport remaining",
        "Free students",
      ].join(",")
    );
    (classMonthReport.classes || []).forEach((row) => {
      lines.push(
        [
          `"${String(row.class_label || "").replaceAll('"', '""')}"`,
          row.student_count,
          row.total_monthly_expected,
          row.total_transport_expected,
          row.total_monthly_paid,
          row.total_transport_paid,
          row.total_monthly_remaining,
          row.total_transport_remaining,
          row.free_students_count,
        ].join(",")
      );
    });
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
    const reportWindow = window.open("", "_blank", "width=1100,height=900");
    if (!reportWindow) return;
    const headCells = [
      "Class",
      "Students",
      "Monthly (total)",
      "Transport (total)",
      "Monthly paid",
      "Transport paid",
      "Monthly remaining",
      "Transport remaining",
      "Free",
    ];
    const headerRow = `<tr>${headCells.map((h) => `<th>${h}</th>`).join("")}</tr>`;
    const bodyRows = (classMonthReport.classes || [])
      .map(
        (r) => `
      <tr>
        <td>${String(r.class_label || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</td>
        <td style="text-align:right">${r.student_count}</td>
        <td style="text-align:right">${r.total_monthly_expected}</td>
        <td style="text-align:right">${r.total_transport_expected}</td>
        <td style="text-align:right">${r.total_monthly_paid}</td>
        <td style="text-align:right">${r.total_transport_paid}</td>
        <td style="text-align:right">${r.total_monthly_remaining}</td>
        <td style="text-align:right">${r.total_transport_remaining}</td>
        <td style="text-align:right">${r.free_students_count}</td>
      </tr>`
      )
      .join("");
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Class fees ${classMonthReport.month_shamsi}</title>
          <style>
            body { font-family: "Segoe UI", Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 1.25rem; margin: 0 0 8px; }
            .muted { color: #64748b; font-size: 0.9rem; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; }
            th { background: #f8fafc; text-align: left; }
            td:nth-child(n + 2) { text-align: right; }
            .note { margin-top: 16px; font-size: 11px; color: #64748b; max-width: 720px; }
          </style>
        </head>
        <body>
          <h1>${String(template.schoolName || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</h1>
          <div class="muted">Class monthly fees â€” Shamsi month ${classMonthReport.month_shamsi}</div>
          <table>
            <thead>${headerRow}</thead>
            <tbody>${bodyRows}</tbody>
          </table>
          <p class="note">
            Free students: students with 0 monthly and 0 transport fee (class defaults or overrides).
            Remaining is per student max(expected âˆ’ paid, 0), summed for the class for this month only.
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

  const exportExpenseStatementCsv = () => {
    if (!expenseStatement) return;
    const lines = [];
    lines.push(`Category,${csvSafe(expenseStatement.category?.name)}`);
    lines.push(`Start,${csvSafe(expenseStatement.filters?.start)}`);
    lines.push(`End,${csvSafe(expenseStatement.filters?.end)}`);
    lines.push(`Total Amount,${csvSafe(expenseStatement.summary?.total_amount)}`);
    lines.push(`Expenses Count,${csvSafe(expenseStatement.summary?.expenses_count)}`);
    lines.push("");
    lines.push("Expenses");
    lines.push("ID,Date,Amount,Paid By,Description");
    (expenseStatement.expenses || []).forEach((item) => {
      lines.push(
        [
          item.id,
          csvSafe(item.date_shamsi),
          csvSafe(item.amount),
          csvSafe(item.paid_by),
          csvSafe(item.description || ""),
        ].join(",")
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expense_statement_${expenseStatement.category?.name || "category"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printExpenseStatement = () => {
    if (!expenseStatement) return;
    const reportWindow = window.open("", "_blank", "width=1100,height=900");
    if (!reportWindow) return;
    const expenseRows = (expenseStatement.expenses || [])
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.date_shamsi)}</td>
            <td>${escapeHtml(item.amount)}</td>
            <td>${escapeHtml(item.paid_by)}</td>
            <td>${escapeHtml(item.description || "")}</td>
          </tr>
        `
      )
      .join("");
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Expense Statement</title>
          <style>
            body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; padding: 24px; }
            h1 { margin: 0; font-size: 1.4rem; }
            .muted { color: #64748b; font-size: 0.9rem; }
            .head { display:flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 16px; }
            .summary { display:grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 14px 0 18px; }
            .summary-card { border:1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; }
            .summary-card .label { color:#64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
            .summary-card .value { font-size: 16px; font-weight: 700; margin-top: 4px; }
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
              <h1>Expense Category Statement</h1>
              <div class="muted">${escapeHtml(expenseStatement.category?.name || "")}</div>
            </div>
            <div style="text-align:right">
              <div class="muted">Start: ${escapeHtml(expenseStatement.filters?.start || "All")}</div>
              <div class="muted">End: ${escapeHtml(expenseStatement.filters?.end || "All")}</div>
            </div>
          </div>
          <div class="summary">
            <div class="summary-card"><div class="label">Total Amount</div><div class="value">${escapeHtml(expenseStatement.summary?.total_amount || "0.00")}</div></div>
            <div class="summary-card"><div class="label">Expenses Count</div><div class="value">${escapeHtml(expenseStatement.summary?.expenses_count || 0)}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Paid By</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>${expenseRows || '<tr><td colspan="4">No expense rows found.</td></tr>'}</tbody>
          </table>
          <div class="signature">
            <div class="sig-box">Prepared By</div>
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
                ? "Per-class tuition and transport totals for one Shamsi month."
                : activeTab === "studentStatement"
                  ? "A printable statement for one student, with payments, fees, and balances."
                  : activeTab === "expenseStatement"
                    ? "A printable statement for one expense category, with total amount and expense ledger."
                  : activeTab === "teacherStatement"
                    ? "A printable salary statement for one teacher, with monthly salary payouts and balance."
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
          <button className="button button-outline" type="button" onClick={exportExpenseStatementCsv}>
            Export CSV
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
        <StatCard label="Total Revenue" value={summary ? summary.total_revenue : "â€”"} />
        <StatCard label="Total Expenses" value={summary ? summary.total_expenses : "â€”"} />
        <StatCard label="Profit" value={summary ? summary.profit : "â€”"} />
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
      </>
      ) : null}

      {activeTab === "classMonth" ? (
        <>
          <div className="panel">
            <h3>Class monthly fees</h3>
            <p className="muted-panel" style={{ marginBottom: 12 }}>
              Select a Shamsi month (YYYY-MM). Each row is one class: student count, total expected monthly and
              transport fees, amounts paid for that month (Monthly / Transport fee types), remaining balances, and
              students with no monthly and no transport fee.
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
              <h3>Results â€” {classMonthReport.month_shamsi}</h3>
              <div className="table">
                <div className="table-head" style={classFeesGridStyle}>
                  <div>Class</div>
                  <div>Students</div>
                  <div>Monthly fees</div>
                  <div>Transport fees</div>
                  <div>Monthly paid</div>
                  <div>Transport paid</div>
                  <div>Monthly left</div>
                  <div>Transport left</div>
                  <div>Free</div>
                </div>
                {classMonthReport.classes.map((row) => (
                  <div className="table-row" key={row.class_id} style={classFeesGridStyle}>
                    <div>{row.class_label}</div>
                    <div>{row.student_count}</div>
                    <div>{row.total_monthly_expected}</div>
                    <div>{row.total_transport_expected}</div>
                    <div>{row.total_monthly_paid}</div>
                    <div>{row.total_transport_paid}</div>
                    <div>{row.total_monthly_remaining}</div>
                    <div>{row.total_transport_remaining}</div>
                    <div>{row.free_students_count}</div>
                  </div>
                ))}
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
              Select one expense category. Start and end dates are optional, but if you enter one, enter both.
            </p>
            <div className="form-grid">
              <Field label="Expense Category">
                <select
                  className="input"
                  value={selectedExpenseCategoryId}
                  onChange={(event) => setSelectedExpenseCategoryId(event.target.value)}
                >
                  <option value="">Select category</option>
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
                  placeholder="1404-01-30"
                />
              </Field>
            </div>
            {loadingExpenseStatement ? <div className="status-message">Generating statement...</div> : null}
            {expenseStatementError ? <div className="form-error">{expenseStatementError}</div> : null}
          </div>

          {expenseStatement ? (
            <>
              <div className="stats-grid">
                <StatCard label="Category" value={expenseStatement.category?.name || "—"} />
                <StatCard label="Total Amount" value={expenseStatement.summary?.total_amount || "—"} />
                <StatCard label="Expenses Count" value={expenseStatement.summary?.expenses_count || "—"} />
              </div>

              <div className="panel">
                <h3>Statement Details</h3>
                <div className="table">
                  <div className="table-head">
                    <div>Field</div>
                    <div>Value</div>
                  </div>
                  <div className="table-row">
                    <div>Category</div>
                    <div>{expenseStatement.category?.name}</div>
                  </div>
                  <div className="table-row">
                    <div>Start</div>
                    <div>{expenseStatement.filters?.start || "All"}</div>
                  </div>
                  <div className="table-row">
                    <div>End</div>
                    <div>{expenseStatement.filters?.end || "All"}</div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <h3>Expense Ledger</h3>
                <div className="table">
                  <div className="table-head">
                    <div>ID</div>
                    <div>Date</div>
                    <div>Amount</div>
                    <div>Paid By</div>
                    <div>Description</div>
                  </div>
                  {(expenseStatement.expenses || []).map((expense) => (
                    <div className="table-row" key={expense.id}>
                      <div>{expense.id}</div>
                      <div>{expense.date_shamsi}</div>
                      <div>{expense.amount}</div>
                      <div>{expense.paid_by}</div>
                      <div>{expense.description || "—"}</div>
                    </div>
                  ))}
                </div>
                {!expenseStatement.expenses?.length ? (
                  <div className="muted-panel" style={{ marginTop: 12 }}>
                    No expense rows found for this statement range.
                  </div>
                ) : null}
              </div>
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

