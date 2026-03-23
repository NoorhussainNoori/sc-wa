import { useEffect, useState } from "react";
import { apiFetch, extractListData, extractPaginationMeta } from "../api.js";
import Field from "../components/Field.jsx";
import PaginationControls from "../components/PaginationControls.jsx";

const emptyClass = {
  name: "",
  year_shamsi: "",
  monthly_fee: "",
  transport_fee: "",
  uniform_fee: "",
  book_fee: "",
};

export default function Classes() {
  const PAGE_SIZE = 10;
  const RECEIPT_TEMPLATE_KEY = "receipt_template_config_v1";
  const [tab, setTab] = useState("management");
  const [classes, setClasses] = useState([]);
  const [classesPage, setClassesPage] = useState(1);
  const [classesMeta, setClassesMeta] = useState({
    count: 0,
    next: null,
    previous: null,
  });
  const [form, setForm] = useState(emptyClass);
  const [error, setError] = useState("");

  const [dueYear, setDueYear] = useState("");
  const [dueMonth, setDueMonth] = useState("01");
  const [dueClassId, setDueClassId] = useState("");
  const [dueClasses, setDueClasses] = useState([]);
  const [dues, setDues] = useState([]);
  const [duesError, setDuesError] = useState("");
  const [duesLoading, setDuesLoading] = useState(false);

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

  const loadClasses = async (page = 1) => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      const data = await apiFetch(`/classes/?${params.toString()}`);
      setClasses(extractListData(data));
      setClassesMeta(extractPaginationMeta(data));
      setClassesPage(page);
    } catch (err) {
      setError(err.message || "Failed to load classes.");
    }
  };

  useEffect(() => {
    const run = async () => {
      await loadClasses(classesPage);
    };
    void run();
  }, []);

  useEffect(() => {
    if (tab !== "dues" || dueClasses.length) return;
    const loadDueClasses = async () => {
      try {
        const params = new URLSearchParams({
          page: "1",
          page_size: "100",
        });
        const data = await apiFetch(`/classes/?${params.toString()}`);
        setDueClasses(extractListData(data));
      } catch {
        // Ignore dropdown loading errors; dues can still work without it (if user doesn't pick a class)
      }
    };
    void loadDueClasses();
  }, [tab, dueClasses.length]);

  const buildMonthShamsi = () => {
    const year = String(dueYear || "").trim();
    const month = String(dueMonth || "").trim();
    if (!/^\d{4}$/.test(year)) return null;
    const monthNum = Number(month);
    if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return null;
    return `${year}-${String(monthNum).padStart(2, "0")}`;
  };

  const loadMonthlyDues = async () => {
    setDuesError("");
    const monthShamsi = buildMonthShamsi();
    if (!monthShamsi) {
      setDuesError("Enter a valid Shamsi year (YYYY) and month (01-12).");
      return;
    }

    setDuesLoading(true);
    try {
      const params = new URLSearchParams({
        month_shamsi: monthShamsi,
      });
      if (dueClassId) params.set("class_id", String(dueClassId));
      const data = await apiFetch(
        `/reports/monthly-dues/?${params.toString()}`
      );
      setDues(data.results || []);
    } catch (err) {
      setDuesError(err.message || "Failed to load dues.");
      setDues([]);
    } finally {
      setDuesLoading(false);
    }
  };

  const printDuesWindow = ({ title, duesToPrint, monthShamsi }) => {
    const receiptWindow = window.open("", "_blank", "width=900,height=900");
    if (!receiptWindow) return;

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

    const logoSvg = `
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="16" fill="#1D4ED8"/>
        <path d="M18 42L32 14L46 42" stroke="#E0F2FE" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M24 42H40" stroke="#E0F2FE" stroke-width="4" stroke-linecap="round"/>
        <circle cx="32" cy="32" r="4" fill="#38BDF8"/>
      </svg>
    `;

    const receipts = duesToPrint.map((d) => {
      const classLabel = `${d.class_name} (${d.class_year_shamsi})`;
      return `
        <div class="receipt-half">
          <div class="receipt-header">
            <div class="receipt-logo">
              <img class="receipt-logo-img" alt="Logo" src="${escapeHtml(template.logoDataUrl || "")}" />
              <div class="receipt-logo-default">${logoSvg}</div>
            </div>
            <div class="receipt-header-text">
              <div class="school-name">${escapeHtml(template.schoolName)}</div>
              <div class="school-address">${escapeHtml(template.schoolAddress)}</div>
              <div class="school-phone">${escapeHtml(template.schoolPhone)}</div>
            </div>
          </div>

          <div class="receipt-title">Due Fees Notice</div>
          <div class="receipt-subtitle">Month: <span>${escapeHtml(monthShamsi)}</span></div>

          <div class="receipt-block">
            <div><span class="label">Student:</span> <span>${escapeHtml(d.student_name)}</span></div>
            <div><span class="label">Father:</span> <span>${escapeHtml(d.father_name)}</span></div>
            <div><span class="label">Phone:</span> <span>${escapeHtml(d.phone)}</span></div>
            <div><span class="label">Class:</span> <span>${escapeHtml(classLabel)}</span></div>
          </div>

          <div class="receipt-table">
            <div class="row"><div>Expected Monthly Fee</div><div class="value">${escapeHtml(d.expected_monthly_fee)}</div></div>
            <div class="row"><div>Paid for Month</div><div class="value">${escapeHtml(d.paid_monthly_fee)}</div></div>
            <div class="row total"><div>Due Amount</div><div class="due-value">${escapeHtml(d.due_amount)}</div></div>
          </div>

          <div class="receipt-footer">
            <div class="thank-you">${escapeHtml(template.thankYouMessage)}</div>
          </div>
        </div>
      `;
    });

    const chunked = [];
    for (let i = 0; i < receipts.length; i += 2) {
      chunked.push(receipts.slice(i, i + 2));
    }

    const pagesHtml = chunked
      .map((pair) => {
        const top = pair[0] || `<div class="receipt-half empty"></div>`;
        const bottom = pair[1] || `<div class="receipt-half empty"></div>`;
        return `
          <section class="a4-page">
            <div class="page-halves">
              ${top}
              ${bottom}
            </div>
          </section>
        `;
      })
      .join("");

    const html = `
      <html>
        <head>
          <title>${escapeHtml(title)}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; }
            .btn { padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5f5; background:#fff; cursor:pointer; font-weight:600; }
            .a4-page { page-break-after: always; }
            .page-halves {
              width: 100%;
              display: flex;
              flex-direction: column;
              gap: 10mm;
            }
            .receipt-half {
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 12px 14px;
              box-sizing: border-box;
              min-height: 122mm;
              display: flex;
              flex-direction: column;
              line-height: 1.2;
            }
            .receipt-half.empty { border-style: dashed; background: #f8fafc; }
            .receipt-header { display:flex; gap: 12px; align-items:flex-start; }
            .receipt-logo { flex: 0 0 auto; display: grid; place-items: start; }
            .receipt-logo-img { width:56px; height:56px; display:${template.logoDataUrl ? "block" : "none"}; object-fit: contain; }
            .receipt-logo-default { display: ${template.logoDataUrl ? "none" : "block"}; }
            .receipt-header-text { flex: 1; }
            .school-name { font-weight: 800; font-size: 1.05rem; margin-bottom: 4px; }
            .school-address { font-size: 0.85rem; color: #475569; }
            .school-phone { font-size: 0.85rem; color: #475569; margin-top: 4px; }
            .receipt-title { margin-top: 10px; font-weight: 800; font-size: 1rem; }
            .receipt-subtitle { font-size: 0.9rem; color:#475569; margin-top: 4px; }
            .receipt-block { margin-top: 12px; display:grid; gap: 6px; font-size:0.92rem; }
            .label { color:#64748b; font-weight: 600; margin-right: 6px; }
            .receipt-table { margin-top: 12px; border-top: 1px dashed #e2e8f0; padding-top: 8px; display:grid; gap: 7px; }
            .receipt-table .row { display:flex; justify-content: space-between; gap: 10px; }
            .receipt-table .total { border-top: 2px solid #dbeafe; padding-top: 10px; }
            .receipt-table .value { font-weight: 700; }
            .receipt-table .due-value { font-weight: 900; color:#1d4ed8; font-size: 1.05rem; }
            .receipt-footer { margin-top: auto; font-size: 0.85rem; color:#475569; padding-top: 10px; }
            @media print { .receipt-half { border-radius: 10px; } .print-tools { display:none !important; } }
          </style>
        </head>
        <body>
          <div class="print-tools" style="position: fixed; top: 12px; right: 12px; z-index: 9999;">
            <button class="btn" type="button" id="downloadBtn">Download HTML</button>
          </div>
          ${pagesHtml}
          <script>
            document.getElementById("downloadBtn").addEventListener("click", () => {
              const html = document.documentElement.outerHTML;
              const blob = new Blob([html], { type: "text/html;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "monthly_dues_receipt.html";
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            });
          </script>
        </body>
      </html>
    `;

    receiptWindow.document.write(html);
    receiptWindow.document.close();
    receiptWindow.focus();
    receiptWindow.print();
  };

  const printAllDues = () => {
    const monthShamsi = buildMonthShamsi() || "";
    printDuesWindow({ title: "Monthly Dues (All Students)", duesToPrint: dues, monthShamsi });
  };

  const printOneDue = (due) => {
    const monthShamsi = buildMonthShamsi() || "";
    printDuesWindow({
      title: "Monthly Dues (One Student)",
      duesToPrint: [due],
      monthShamsi,
    });
  };

  const dueIsEmpty = duesLoading || dues.length === 0;

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/classes/", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(emptyClass);
      await loadClasses();
    } catch (err) {
      setError(err.message || "Failed to create class.");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Classes</h2>
          <p>Create classes per year and define fee settings.</p>
        </div>
        <div className="inline-actions">
          <button
            className={tab === "management" ? "button button-primary" : "button button-outline"}
            type="button"
            onClick={() => setTab("management")}
          >
            Classes
          </button>
          <button
            className={tab === "dues" ? "button button-primary" : "button button-outline"}
            type="button"
            onClick={() => setTab("dues")}
          >
            Monthly Dues
          </button>
        </div>
      </div>

      {tab === "management" ? (
        <>
          <div className="panel">
            <h3>New Class</h3>
            <form className="form-grid" onSubmit={onSubmit}>
              <Field label="Class Name">
                <input className="input" value={form.name} onChange={onChange("name")} required />
              </Field>
              <Field label="Shamsi Year (YYYY)">
                <input
                  className="input"
                  value={form.year_shamsi}
                  onChange={onChange("year_shamsi")}
                  required
                />
              </Field>
              <Field label="Monthly Fee">
                <input
                  className="input"
                  value={form.monthly_fee}
                  onChange={onChange("monthly_fee")}
                  required
                />
              </Field>
              <Field label="Transport Fee">
                <input
                  className="input"
                  value={form.transport_fee}
                  onChange={onChange("transport_fee")}
                  required
                />
              </Field>
              <Field label="Uniform Fee">
                <input
                  className="input"
                  value={form.uniform_fee}
                  onChange={onChange("uniform_fee")}
                  required
                />
              </Field>
              <Field label="Book Fee">
                <input
                  className="input"
                  value={form.book_fee}
                  onChange={onChange("book_fee")}
                  required
                />
              </Field>
              <button className="button button-primary" type="submit">
                Save Class
              </button>
            </form>
            {error ? <div className="form-error">{error}</div> : null}
          </div>

          <div className="panel">
            <h3>Class List</h3>
            <div className="table">
              <div className="table-head">
                <div>ID</div>
                <div>Name</div>
                <div>Year</div>
                <div>Monthly</div>
                <div>Transport</div>
                <div>Uniform</div>
                <div>Book</div>
              </div>
              {classes.map((cls) => (
                <div className="table-row" key={cls.id}>
                  <div>{cls.id}</div>
                  <div>{cls.name}</div>
                  <div>{cls.year_shamsi}</div>
                  <div>{cls.monthly_fee}</div>
                  <div>{cls.transport_fee}</div>
                  <div>{cls.uniform_fee}</div>
                  <div>{cls.book_fee}</div>
                </div>
              ))}
            </div>
            <PaginationControls
              count={classesMeta.count}
              currentPage={classesPage}
              pageSize={PAGE_SIZE}
              hasPrevious={Boolean(classesMeta.previous)}
              hasNext={Boolean(classesMeta.next)}
              onPrevious={() => loadClasses(Math.max(1, classesPage - 1))}
              onNext={() => loadClasses(classesPage + 1)}
            />
          </div>
        </>
      ) : (
        <div className="panel">
          <h3>Monthly Fee Dues</h3>
          <div className="form-grid" style={{ marginBottom: 8 }}>
            <Field label="Year (YYYY)">
              <input
                className="input"
                value={dueYear}
                onChange={(event) => setDueYear(event.target.value)}
                placeholder="1404"
              />
            </Field>
            <Field label="Month">
              <select
                className="input"
                value={dueMonth}
                onChange={(event) => setDueMonth(event.target.value)}
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const v = String(i + 1).padStart(2, "0");
                  return (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field label="Class">
              <select
                className="input"
                value={dueClassId}
                onChange={(event) => setDueClassId(event.target.value)}
              >
                <option value="">All Classes</option>
                {dueClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.year_shamsi})
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="inline-actions" style={{ marginBottom: 12 }}>
            <button
              className="button button-primary"
              type="button"
              onClick={loadMonthlyDues}
              disabled={duesLoading}
            >
              {duesLoading ? "Loading..." : "Show Dues"}
            </button>
            <button
              className="button button-outline"
              type="button"
              onClick={printAllDues}
              disabled={dueIsEmpty}
            >
              Print All
            </button>
          </div>

          {duesError ? <div className="form-error">{duesError}</div> : null}

          <div className="dues-cards">
            {dues.map((d) => (
              <div className="due-card" key={d.student_id}>
                <div className="due-card-title">Monthly Fee Due</div>
                <div className="due-card-row">
                  <span className="due-card-label">Student</span>
                  <span>{d.student_name}</span>
                </div>
                <div className="due-card-row">
                  <span className="due-card-label">Father</span>
                  <span>{d.father_name}</span>
                </div>
                <div className="due-card-row">
                  <span className="due-card-label">Phone</span>
                  <span>{d.phone}</span>
                </div>
                <div className="due-card-row">
                  <span className="due-card-label">Class</span>
                  <span>
                    {d.class_name} ({d.class_year_shamsi})
                  </span>
                </div>
                <div className="due-card-row due-card-total">
                  <span className="due-card-label">Due Amount</span>
                  <span>{d.due_amount}</span>
                </div>
                <div className="due-card-actions">
                  <button
                    className="button button-outline"
                    type="button"
                    onClick={() => printOneDue(d)}
                  >
                    Print One
                  </button>
                </div>
              </div>
            ))}
          </div>

          {dues.length === 0 && !duesLoading ? (
            <div className="muted-panel" style={{ marginTop: 12 }}>
              No dues for the selected month.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
