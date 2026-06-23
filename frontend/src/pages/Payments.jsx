import { useEffect, useState } from "react";
import { apiFetch, extractListData, extractPaginationMeta } from "../api.js";
import Field from "../components/Field.jsx";
import PaginationControls from "../components/PaginationControls.jsx";

const emptyPaymentItem = {
  fee_type: "",
  amount: "",
  other_reason: "",
};

const emptyPayment = {
  bill_number: "",
  date_shamsi: "",
  date_year: "",
  date_month: "",
  date_day: "",
  notes: "",
  items: [{ ...emptyPaymentItem }],
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
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [error, setError] = useState("");
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [savingPayments, setSavingPayments] = useState(false);

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
    setSearchingStudents(true);
    try {
      const params = new URLSearchParams({
        q: search,
        is_active: "1",
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      const data = await apiFetch(`/students/?${params.toString()}`);
      setStudents(extractListData(data));
      setStudentsMeta(extractPaginationMeta(data));
      setStudentsPage(page);
    } catch (err) {
      setError(err.message || "Failed to search students.");
    } finally {
      setSearchingStudents(false);
    }
  };

  const loadPayments = async (studentId, page = 1) => {
    setLoadingPayments(true);
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
    } finally {
      setLoadingPayments(false);
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
  };

  const onItemChange = (index, field) => (event) => {
    const value = event.target.value;
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const onItemFeeTypeChange = (index) => (event) => {
    const nextFeeType = event.target.value;
    setForm((prev) => {
      const items = [...prev.items];
      const item = { ...items[index], fee_type: nextFeeType };
      if (selectedStudent) {
        const nextAmount = deriveFeeAmount(selectedStudent, nextFeeType);
        if (nextAmount) item.amount = String(nextAmount);
      }
      items[index] = item;
      return { ...prev, items };
    });
  };

  const addPaymentItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...emptyPaymentItem }] }));
  };

  const removePaymentItem = (index) => {
    setForm((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: items.length ? items : [{ ...emptyPaymentItem }] };
    });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!selectedStudent) {
      setError("Select a student first.");
      return;
    }
    setError("");
    setSavingPayments(true);
    try {
      const dateShamsi = buildDateShamsi(form.date_year, form.date_month, form.date_day);
      const effectiveBillNumber = String(form.bill_number || "").trim() || generateBillNumber();
      const itemsToSubmit = form.items.filter((item) => item.fee_type && item.amount);
      if (!itemsToSubmit.length) {
        setError("Add at least one valid fee type and amount.");
        return;
      }

      const submittedItems = [];
      for (const item of itemsToSubmit) {
        await apiFetch("/payments/", {
          method: "POST",
          body: JSON.stringify({
            bill_number: effectiveBillNumber,
            amount: item.amount,
            date_shamsi: dateShamsi,
            student: selectedStudent.id,
            fee_type: item.fee_type,
            other_reason: item.other_reason || "",
            notes: form.notes || "",
          }),
        });

        const typeEntry = feeTypes.find((type) => String(type.id) === String(item.fee_type));
        submittedItems.push({
          fee_type_name: typeEntry?.name || item.fee_type,
          amount: item.amount,
          other_reason: item.other_reason || "",
        });
      }

      setForm(emptyPayment);
      await loadPayments(selectedStudent.id, paymentsPage);
      printReceipt({
        student: selectedStudent,
        classInfo: classes.find((cls) => cls.id === selectedStudent.school_class),
        paymentHeader: {
          bill_number: effectiveBillNumber,
          date_shamsi: dateShamsi,
          notes: form.notes || "",
        },
        items: submittedItems,
      });
    } catch (err) {
      setError(err.message || "Failed to save payment.");
    } finally {
      setSavingPayments(false);
    }
  };

  const deriveFeeAmount = (student, feeTypeId) => {
    const classEntry = classes.find((cls) => cls.id === student?.school_class);
    const typeEntry = feeTypes.find((type) => String(type.id) === String(feeTypeId));
    if (!typeEntry) return "";
    const typeName = typeEntry.name.toLowerCase();
    if (typeName.includes("previous balance")) return student?.previous_balance || "";
    if (!classEntry) return "";
    if (typeName.includes("monthly")) return student?.monthly_fee_override || classEntry.monthly_fee;
    if (typeName.includes("transport")) return student?.transport_fee_override || classEntry.transport_fee;
    if (typeName.includes("uniform")) return student?.uniform_fee_override || classEntry.uniform_fee;
    if (typeName.includes("book")) return student?.book_fee_override || classEntry.book_fee;
    return "";
  };

  const onEditPayment = (payment) => {
    setEditingPaymentId(payment.id);
    setForm((prev) => ({
      ...prev,
      bill_number: payment.bill_number || "",
      date_shamsi: payment.date_shamsi || "",
      notes: payment.notes || "",
      items: [
        {
          fee_type: payment.fee_type || "",
          amount: payment.amount || "",
          other_reason: payment.other_reason || "",
        },
      ],
    }));
  };

  const onDeletePayment = async (payment) => {
    if (!window.confirm(`Delete payment #${payment.id}?`)) return;
    setError("");
    try {
      await apiFetch(`/payments/${payment.id}/`, { method: "DELETE" });
      if (editingPaymentId === payment.id) {
        setEditingPaymentId(null);
        setForm(emptyPayment);
      }
      if (selectedStudent) {
        await loadPayments(selectedStudent.id, paymentsPage);
      }
    } catch (err) {
      setError(err.message || "Failed to delete payment.");
    }
  };

  const onUpdateSinglePayment = async () => {
    if (!editingPaymentId || !selectedStudent) return;
    const item = form.items[0];
    if (!item?.fee_type || !item?.amount) {
      setError("Fee type and amount are required.");
      return;
    }
    setError("");
    setSavingPayments(true);
    try {
      await apiFetch(`/payments/${editingPaymentId}/`, {
        method: "PUT",
        body: JSON.stringify({
          student: selectedStudent.id,
          fee_type: item.fee_type,
          bill_number: String(form.bill_number || "").trim() || generateBillNumber(),
          amount: item.amount,
          date_shamsi: form.date_shamsi,
          other_reason: item.other_reason || "",
          notes: form.notes || "",
        }),
      });
      setEditingPaymentId(null);
      setForm(emptyPayment);
      await loadPayments(selectedStudent.id, paymentsPage);
    } catch (err) {
      setError(err.message || "Failed to update payment.");
    } finally {
      setSavingPayments(false);
    }
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
            placeholder="Name, registration number, father, grandfather, phone..."
          />
          <button className="button button-outline" onClick={() => searchStudents(1)} disabled={searchingStudents}>
            {searchingStudents ? "Searching..." : "Search"}
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
              {student.name} ({student.registration_number || "No Reg"}) - {student.father_name}
            </button>
          ))}
        </div>
        {!searchingStudents && students.length === 0 ? (
          <div className="muted-panel" style={{ marginTop: 12 }}>
            No students found.
          </div>
        ) : null}
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
                selectedStudent
                  ? `${selectedStudent.name} (${selectedStudent.registration_number || "No Reg"})`
                  : ""
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
          <Field label="Bill Number (optional)">
            <input
              className="input"
              value={form.bill_number}
              onChange={onChange("bill_number")}
              placeholder="Auto generated if left empty"
            />
          </Field>
          <Field label="Shamsi Year">
            <input
              className="input"
              value={form.date_year}
              onChange={onChange("date_year")}
              placeholder="1404"
              required={!editingPaymentId}
            />
          </Field>
          <Field label="Shamsi Month">
            <select
              className="input"
              value={form.date_month}
              onChange={onChange("date_month")}
              required={!editingPaymentId}
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
              required={!editingPaymentId}
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
          {editingPaymentId ? (
            <Field label="Date (Shamsi YYYY-MM-DD)">
              <input
                className="input"
                value={form.date_shamsi || ""}
                onChange={onChange("date_shamsi")}
                placeholder="1404-01-10"
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
          {editingPaymentId ? (
            <button className="button button-primary" type="button" onClick={onUpdateSinglePayment} disabled={savingPayments}>
              {savingPayments ? "Saving..." : "Update Payment"}
            </button>
          ) : (
            <button className="button button-primary" type="submit" disabled={savingPayments}>
              {savingPayments ? "Saving..." : "Save Payment"}
            </button>
          )}
          {editingPaymentId ? (
            <button
              className="button button-outline"
              type="button"
              onClick={() => {
                setEditingPaymentId(null);
                setForm(emptyPayment);
              }}
            >
              Cancel Edit
            </button>
          ) : null}
          {editingPaymentId ? (
            <div className="status-message">Edit mode updates one payment row only.</div>
          ) : null}
        </form>
        {selectedStudent ? (
          <div className="muted-panel" style={{ marginTop: 12 }}>
            Previous year balance on student record: <strong>{selectedStudent.previous_balance || "0.00"}</strong>. Use the
            <strong> Previous Balance </strong>
            fee type when the student pays old debt so the reports reduce it correctly.
          </div>
        ) : null}
        <div className="panel" style={{ marginTop: 12 }}>
          <h4>Fee Items (Multiple allowed)</h4>
          <div className="table">
            <div className="table-head">
              <div>Fee Type</div>
              <div>Amount</div>
              <div>Other Reason</div>
              <div>Action</div>
            </div>
            {form.items.map((item, index) => {
              const selectedType = feeTypes.find((type) => String(type.id) === String(item.fee_type));
              return (
                <div className="table-row" key={`item-${index}`}>
                  <div>
                    <select
                      className="input"
                      value={item.fee_type}
                      onChange={onItemFeeTypeChange(index)}
                      required
                    >
                      <option value="">Select type</option>
                      {feeTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      className="input"
                      value={item.amount}
                      onChange={onItemChange(index, "amount")}
                      required
                    />
                  </div>
                  <div>
                    <input
                      className="input"
                      value={item.other_reason}
                      onChange={onItemChange(index, "other_reason")}
                      placeholder={selectedType?.requires_reason ? "Required for this type" : "Optional"}
                      required={Boolean(selectedType?.requires_reason)}
                    />
                  </div>
                  <div>
                    <button
                      className="button button-outline"
                      type="button"
                      onClick={() => removePaymentItem(index)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {!editingPaymentId ? (
            <button className="button button-outline" type="button" onClick={addPaymentItem}>
              Add Another Fee Type
            </button>
          ) : null}
        </div>
        {loadingPayments ? <div className="status-message">Loading payment history...</div> : null}
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
            <div>Actions</div>
          </div>
          {payments.map((payment) => {
            return (
            <div className="table-row" key={payment.id}>
              <div>{payment.id}</div>
              <div>{payment.fee_type_name || payment.fee_type}</div>
              <div>{payment.amount}</div>
              <div>{payment.date_shamsi}</div>
              <div>{payment.other_reason || "—"}</div>
              <div className="inline-actions">
                <button className="button button-outline" type="button" onClick={() => onEditPayment(payment)}>
                  Edit
                </button>
                <button className="button button-outline" type="button" onClick={() => onDeletePayment(payment)}>
                  Delete
                </button>
              </div>
            </div>
            );
          })}
        </div>
        {!loadingPayments && payments.length === 0 ? (
          <div className="muted-panel" style={{ marginTop: 12 }}>
            No payment records found.
          </div>
        ) : null}
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

function generateBillNumber() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;
}

function printReceipt({ student, classInfo, paymentHeader, items }) {
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
          <div class="row"><span>Registration No</span><strong>${escapeHtml(student?.registration_number || "-")}</strong></div>
          <div class="row"><span>Father</span><strong>${escapeHtml(student?.father_name || "")}</strong></div>
          <div class="row"><span>Class</span><strong>${classInfo ? escapeHtml(`${classInfo.name} (${classInfo.year_shamsi})`) : ""}</strong></div>
          <div class="row"><span>Bill No</span><strong>${escapeHtml(paymentHeader?.bill_number || "")}</strong></div>
          <div class="row"><span>Date (Shamsi)</span><strong>${escapeHtml(paymentHeader?.date_shamsi || "")}</strong></div>
          <div class="row"><span>Notes</span><strong>${escapeHtml(paymentHeader?.notes || "-")}</strong></div>
          <div class="divider"></div>
          ${items
            .map(
              (item) => `
            <div class="row"><span>Fee Type</span><strong>${escapeHtml(item.fee_type_name)}</strong></div>
            <div class="row"><span>Amount</span><strong>${escapeHtml(item.amount)}</strong></div>
            <div class="row"><span>Reason</span><strong>${escapeHtml(item.other_reason || "-")}</strong></div>
            <div class="divider"></div>
          `
            )
            .join("")}
          <div class="row"><span>Total</span><strong class="total">${escapeHtml(
            items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
          )}</strong></div>
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
