import { useEffect, useState } from "react";
import { apiFetch, extractListData, extractPaginationMeta } from "../api.js";
import Field from "../components/Field.jsx";
import PaginationControls from "../components/PaginationControls.jsx";

const emptyPayment = {
  fee_type: "",
  bill_number: "",
  amount: "",
  date_shamsi: "",
  date_year: "",
  date_month: "",
  date_day: "",
  other_reason: "",
  notes: "",
};

export default function Payments() {
  const PAGE_SIZE = 10;
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsMeta, setStudentsMeta] = useState({
    count: 0,
    next: null,
    previous: null,
  });
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [feeTypes, setFeeTypes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsMeta, setPaymentsMeta] = useState({
    count: 0,
    next: null,
    previous: null,
  });
  const [form, setForm] = useState(emptyPayment);
  const [error, setError] = useState("");

  const loadFeeTypes = async () => {
    try {
      const data = await apiFetch("/fee-types/?page_size=100");
      setFeeTypes(extractListData(data));
    } catch (err) {
      setError(err.message || "Failed to load fee types.");
    }
  };

  const loadClasses = async () => {
    try {
      const data = await apiFetch("/classes/?page_size=100");
      setClasses(extractListData(data));
    } catch (err) {
      setError(err.message || "Failed to load classes.");
    }
  };

  const searchStudents = async (page = 1) => {
    setError("");
    try {
      const params = new URLSearchParams({
        q: search,
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      const data = await apiFetch(`/students/?${params.toString()}`);
      setStudents(extractListData(data));
      setStudentsMeta(extractPaginationMeta(data));
      setStudentsPage(page);
    } catch (err) {
      setError(err.message || "Failed to search students.");
    }
  };

  const loadPayments = async (studentId, page = 1) => {
    try {
      const params = new URLSearchParams({
        student_id: String(studentId),
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      const data = await apiFetch(`/payments/?${params.toString()}`);
      setPayments(extractListData(data));
      setPaymentsMeta(extractPaginationMeta(data));
      setPaymentsPage(page);
    } catch (err) {
      setError(err.message || "Failed to load payments.");
    }
  };

  useEffect(() => {
    const run = async () => {
      await Promise.all([loadFeeTypes(), loadClasses()]);
    };
    void run();
  }, []);

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const onSelectStudent = (student) => {
    setSelectedStudent(student);
    loadPayments(student.id, 1);
    if (form.fee_type) {
      const nextAmount = deriveFeeAmount(student, form.fee_type);
      if (nextAmount) {
        setForm((prev) => ({ ...prev, amount: nextAmount }));
      }
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!selectedStudent) {
      setError("Select a student first.");
      return;
    }
    setError("");
    try {
      const dateShamsi = buildDateShamsi(form.date_year, form.date_month, form.date_day);
      await apiFetch("/payments/", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          date_shamsi: dateShamsi,
          student: selectedStudent.id,
        }),
      });
      setForm(emptyPayment);
      await loadPayments(selectedStudent.id, paymentsPage);
      printReceipt({
        student: selectedStudent,
        feeType: feeTypes.find((type) => String(type.id) === String(form.fee_type)),
        classInfo: classes.find((cls) => cls.id === selectedStudent.school_class),
        payment: {
          ...form,
          date_shamsi: dateShamsi,
        },
      });
    } catch (err) {
      setError(err.message || "Failed to save payment.");
    }
  };

  const selectedFeeType = feeTypes.find(
    (type) => String(type.id) === String(form.fee_type)
  );

  const deriveFeeAmount = (student, feeTypeId) => {
    const classEntry = classes.find((cls) => cls.id === student?.school_class);
    const typeEntry = feeTypes.find((type) => String(type.id) === String(feeTypeId));
    if (!classEntry || !typeEntry) return "";
    const typeName = typeEntry.name.toLowerCase();
    if (typeName.includes("monthly")) return student?.monthly_fee_override || classEntry.monthly_fee;
    if (typeName.includes("transport")) return student?.transport_fee_override || classEntry.transport_fee;
    if (typeName.includes("uniform")) return student?.uniform_fee_override || classEntry.uniform_fee;
    if (typeName.includes("book")) return student?.book_fee_override || classEntry.book_fee;
    return "";
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Payments</h2>
          <p>Collect fees and track payment history.</p>
        </div>
      </div>

      <div className="panel">
        <h3>Find Student</h3>
        <div className="inline-actions">
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, father, grandfather, phone, bill..."
          />
          <button className="button button-outline" onClick={() => searchStudents(1)}>
            Search
          </button>
        </div>
        <div className="pill-list">
          {students.map((student) => (
            <button
              key={student.id}
              className={`pill ${selectedStudent?.id === student.id ? "pill-active" : ""}`}
              onClick={() => onSelectStudent(student)}
              type="button"
            >
              {student.name} - {student.father_name}
            </button>
          ))}
        </div>
        <PaginationControls
          count={studentsMeta.count}
          currentPage={studentsPage}
          pageSize={PAGE_SIZE}
          hasPrevious={Boolean(studentsMeta.previous)}
          hasNext={Boolean(studentsMeta.next)}
          onPrevious={() => searchStudents(Math.max(1, studentsPage - 1))}
          onNext={() => searchStudents(studentsPage + 1)}
        />
      </div>

      <div className="panel">
        <h3>New Payment</h3>
        <form className="form-grid" onSubmit={onSubmit}>
          <Field label="Selected Student">
            <input
              className="input"
              value={
                selectedStudent ? `${selectedStudent.name} (${selectedStudent.father_name})` : ""
              }
              readOnly
              placeholder="Select a student above"
            />
          </Field>
          <Field label="Class">
            <input
              className="input"
              value={
                (() => {
                  const classEntry = classes.find(
                    (cls) => cls.id === selectedStudent?.school_class
                  );
                  return classEntry
                    ? `${classEntry.name} (${classEntry.year_shamsi})`
                    : "";
                })()
              }
              readOnly
              placeholder="Select a student above"
            />
          </Field>
          <Field label="Fee Type">
            <select
              className="input"
              value={form.fee_type}
              onChange={(event) => {
                const nextFeeType = event.target.value;
                setForm((prev) => ({ ...prev, fee_type: nextFeeType }));
                if (selectedStudent) {
                  const nextAmount = deriveFeeAmount(selectedStudent, nextFeeType);
                  if (nextAmount) {
                    setForm((prev) => ({ ...prev, fee_type: nextFeeType, amount: nextAmount }));
                  }
                }
              }}
              required
            >
              <option value="">Select type</option>
              {feeTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bill Number">
            <input className="input" value={form.bill_number} onChange={onChange("bill_number")} required />
          </Field>
          <Field label="Amount">
            <input className="input" value={form.amount} onChange={onChange("amount")} required />
          </Field>
          <Field label="Shamsi Year">
            <input
              className="input"
              value={form.date_year}
              onChange={onChange("date_year")}
              placeholder="1404"
              required
            />
          </Field>
          <Field label="Shamsi Month">
            <select
              className="input"
              value={form.date_month}
              onChange={onChange("date_month")}
              required
            >
              <option value="">Select month</option>
              {Array.from({ length: 12 }).map((_, index) => {
                const monthValue = String(index + 1).padStart(2, "0");
                return (
                  <option key={monthValue} value={monthValue}>
                    {monthValue}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field label="Shamsi Day">
            <select
              className="input"
              value={form.date_day}
              onChange={onChange("date_day")}
              required
            >
              <option value="">Select day</option>
              {Array.from({ length: 31 }).map((_, index) => {
                const dayValue = String(index + 1).padStart(2, "0");
                return (
                  <option key={dayValue} value={dayValue}>
                    {dayValue}
                  </option>
                );
              })}
            </select>
          </Field>
          {selectedFeeType?.requires_reason ? (
            <Field label="Other Reason">
              <input
                className="input"
                value={form.other_reason}
                onChange={onChange("other_reason")}
                placeholder="Reason for this payment"
                required
              />
            </Field>
          ) : null}
          <Field label="Notes">
            <input
              className="input"
              value={form.notes}
              onChange={onChange("notes")}
              placeholder="Optional notes"
            />
          </Field>
          <button className="button button-primary" type="submit">
            Save Payment
          </button>
        </form>
        {error ? <div className="form-error">{error}</div> : null}
      </div>

      <div className="panel">
        <h3>Payment History</h3>
        <div className="table">
          <div className="table-head">
            <div>ID</div>
            <div>Type</div>
            <div>Amount</div>
            <div>Date</div>
            <div>Reason</div>
          </div>
          {payments.map((payment) => {
            const typeEntry = feeTypes.find((type) => type.id === payment.fee_type);
            return (
            <div className="table-row" key={payment.id}>
              <div>{payment.id}</div>
              <div>{typeEntry ? typeEntry.name : payment.fee_type}</div>
              <div>{payment.amount}</div>
              <div>{payment.date_shamsi}</div>
              <div>{payment.other_reason || "—"}</div>
            </div>
            );
          })}
        </div>
        <PaginationControls
          count={paymentsMeta.count}
          currentPage={paymentsPage}
          pageSize={PAGE_SIZE}
          hasPrevious={Boolean(paymentsMeta.previous)}
          hasNext={Boolean(paymentsMeta.next)}
          onPrevious={() =>
            selectedStudent ? loadPayments(selectedStudent.id, Math.max(1, paymentsPage - 1)) : null
          }
          onNext={() => (selectedStudent ? loadPayments(selectedStudent.id, paymentsPage + 1) : null)}
        />
      </div>
    </div>
  );
}

function buildDateShamsi(year, month, day) {
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function printReceipt({ student, feeType, classInfo, payment }) {
  const RECEIPT_TEMPLATE_KEY = "receipt_template_config_v1";

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

  const defaultTemplate = {
    schoolName: "Watan Oxford High School",
    schoolAddress: "School Address (Update Later)",
    schoolPhone: "0700 000 000",
    thankYouMessage: "Thank you for your attention and timely payment.",
    logoDataUrl: "",
  };

  let template = defaultTemplate;
  try {
    const raw = localStorage.getItem(RECEIPT_TEMPLATE_KEY);
    if (raw) {
      template = { ...defaultTemplate, ...JSON.parse(raw) };
    }
  } catch {
    template = defaultTemplate;
  }

  const receiptWindow = window.open("", "_blank", "width=700,height=800");
  if (!receiptWindow) return;

  const logoSvg = `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="16" fill="#1D4ED8"/>
      <path d="M18 42L32 14L46 42" stroke="#E0F2FE" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M24 42H40" stroke="#E0F2FE" stroke-width="4" stroke-linecap="round"/>
      <circle cx="32" cy="32" r="4" fill="#38BDF8"/>
    </svg>
  `;

  const logoHtml = template.logoDataUrl
    ? `<img src="${escapeHtml(template.logoDataUrl)}" alt="Logo" style="width:64px;height:64px;border-radius:16px;object-fit:contain;" />`
    : logoSvg;

  const html = `
    <html>
      <head>
        <title>Payment Receipt</title>
        <style>
          body { font-family: "Segoe UI", Arial, sans-serif; padding: 28px; color: #0f172a; }
          h1 { margin: 0; font-size: 1.6rem; }
          .muted { color: #64748b; font-size: 0.9rem; }
          .header { display: flex; justify-content: space-between; align-items: center; }
          .school { display: flex; gap: 16px; align-items: center; }
          .meta { text-align: right; }
          .row { display: flex; justify-content: space-between; margin: 8px 0; }
          .box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-top: 18px; }
          .total { font-size: 1.4rem; font-weight: 700; color: #1d4ed8; }
          .divider { height: 1px; background: #e2e8f0; margin: 16px 0; }
          .label { color: #64748b; font-size: 0.85rem; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="school">
            ${logoHtml}
            <div>
              <h1>${escapeHtml(template.schoolName)}</h1>
              <div class="muted">Payment Receipt</div>
            </div>
          </div>
          <div class="meta">
            <div class="label">Phone</div>
            <div>${escapeHtml(template.schoolPhone)}</div>
            <div class="label" style="margin-top: 6px;">Address</div>
            <div>${escapeHtml(template.schoolAddress)}</div>
          </div>
        </div>
        <div class="divider"></div>
          <div class="box">
          <div class="row"><span>Student</span><strong>${escapeHtml(student?.name || "")}</strong></div>
          <div class="row"><span>Father</span><strong>${escapeHtml(student?.father_name || "")}</strong></div>
          <div class="row"><span>Class</span><strong>${classInfo ? escapeHtml(`${classInfo.name} (${classInfo.year_shamsi})`) : ""}</strong></div>
          <div class="row"><span>Bill No</span><strong>${escapeHtml(payment?.bill_number || "")}</strong></div>
          <div class="row"><span>Fee Type</span><strong>${escapeHtml(feeType?.name || "")}</strong></div>
          <div class="row"><span>Date (Shamsi)</span><strong>${escapeHtml(payment?.date_shamsi || "")}</strong></div>
          <div class="row"><span>Amount</span><strong class="total">${escapeHtml(payment?.amount || "")}</strong></div>
          <div class="row"><span>Reason</span><strong>${escapeHtml(payment?.other_reason || "-")}</strong></div>
        </div>
        <div class="muted" style="margin-top: 16px;">Generated by School Finance System</div>
        <div class="muted" style="margin-top: 8px; font-weight: 600; color:#475569;">${escapeHtml(
          template.thankYouMessage
        )}</div>
      </body>
    </html>
  `;

  receiptWindow.document.write(html);
  receiptWindow.document.close();
  receiptWindow.focus();
  receiptWindow.print();
}
