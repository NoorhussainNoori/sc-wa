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

/** Solar Hijri (Shamsi) month names as used in Dari — 1–12. */
const SHAMSI_MONTHS = [
  { value: "01", dari: "حمل", latin: "Hamal" },
  { value: "02", dari: "ثور", latin: "Sawer" },
  { value: "03", dari: "جوزا", latin: "Jawza" },
  { value: "04", dari: "سرطان", latin: "Saratan" },
  { value: "05", dari: "اسد", latin: "Aasd" },
  { value: "06", dari: "سنبله", latin: "Sanbula" },
  { value: "07", dari: "میزان", latin: "Mizan" },
  { value: "08", dari: "عقرب", latin: "Aqrab" },
  { value: "09", dari: "قوس", latin: "Qawss" },
  { value: "10", dari: "جدی", latin: "Jadi" },
  { value: "11", dari: "دلو", latin: "Dalwa" },
  { value: "12", dari: "حوت", latin: "Hoot" },
];

function formatMonthShamsiWithNames(monthShamsi) {
  if (!monthShamsi || !/^\d{4}-\d{2}$/.test(monthShamsi)) {
    return monthShamsi || "";
  }
  const [y, mon] = monthShamsi.split("-");
  const entry = SHAMSI_MONTHS.find((m) => m.value === mon);
  const namePart = entry ? `${entry.dari} ${entry.latin}` : mon;
  return `${y}-${mon} — ${namePart}`;
}

/** Dari month name only (برج), for bill tables. */
function formatDariMonthBurj(monthShamsi) {
  if (!monthShamsi || !/^\d{4}-\d{2}$/.test(monthShamsi)) return "—";
  const mon = monthShamsi.split("-")[1];
  return SHAMSI_MONTHS.find((m) => m.value === mon)?.dari || mon;
}

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
  const [editingClassId, setEditingClassId] = useState(null);
  const [error, setError] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [savingClass, setSavingClass] = useState(false);

  const [dueYear, setDueYear] = useState("");
  const [dueMonth, setDueMonth] = useState("01");
  const [dueClassId, setDueClassId] = useState("");
  const [dueClasses, setDueClasses] = useState([]);
  const [dues, setDues] = useState([]);
  const [duesError, setDuesError] = useState("");
  const [duesLoading, setDuesLoading] = useState(false);
  const [duesPeriodSummary, setDuesPeriodSummary] = useState(null);

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
    setLoadingClasses(true);
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
    } finally {
      setLoadingClasses(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      await loadClasses(1);
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
      setDuesPeriodSummary({
        from: data.dues_from_month_shamsi,
        through: data.month_shamsi,
        monthsCount: data.months_count,
      });
    } catch (err) {
      setDuesError(err.message || "Failed to load dues.");
      setDues([]);
      setDuesPeriodSummary(null);
    } finally {
      setDuesLoading(false);
    }
  };

  const printDuesWindow = ({ title, duesToPrint, monthShamsi }) => {
    const monthLine = formatMonthShamsiWithNames(monthShamsi);
    const burj = formatDariMonthBurj(monthShamsi);
    const receiptWindow = window.open("", "_blank", "width=900,height=900");
    if (!receiptWindow) return;

    const defaultTemplate = {
      schoolName: "Watan Oxford High School",
      schoolAddress: "School Address (Update Later)",
      schoolPhone: "0700 000 000",
      thankYouMessage: "Thank you for your attention and timely payment.",
      logoDataUrl: "",
      dariBillTitle: "لیسه خصوصی وطن آکسفور\u0689 فیس بل",
      englishFeesBillLine: "Watan Oxford High School FeesBill",
      dariBillFooterNote:
        "یاداشت: والدین گرامی در تحویلی فیس فرزندان تان کوشش نماید تا در وقت معین فیس مذکور را تادیه نموده تا همکار با آداره لیسه در زمینه معاشات استادان باشید.",
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

    const englishBillLine =
      template.englishFeesBillLine && String(template.englishFeesBillLine).trim()
        ? template.englishFeesBillLine
        : `${template.schoolName} FeesBill`;

    const logoSvg = `
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="16" fill="#1D4ED8"/>
        <path d="M18 42L32 14L46 42" stroke="#E0F2FE" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M24 42H40" stroke="#E0F2FE" stroke-width="4" stroke-linecap="round"/>
        <circle cx="32" cy="32" r="4" fill="#38BDF8"/>
      </svg>
    `;
    const logoBlock = template.logoDataUrl
      ? `<img class="bill-logo-img" alt="" src="${escapeHtml(template.logoDataUrl)}" />`
      : `<div class="bill-logo-fallback">${logoSvg}</div>`;

    const receipts = duesToPrint.map((d) => {
      const classLabel = `${d.class_name} (${d.class_year_shamsi})`;
      const dueMonthlyPrev = d.due_monthly_fee_previous ?? "";
      const dueMonthlyCurr = d.due_monthly_fee_current ?? "";
      const dueTransportPrev = d.due_transport_fee_previous ?? "";
      const dueTransportCurr = d.due_transport_fee_current ?? "";
      const duePreviousBalance = d.due_previous_balance ?? "";
      const burjMonthlyPrevCount =
        d.due_monthly_previous_months_count != null
          ? String(d.due_monthly_previous_months_count)
          : "";
      const burjTransportPrevCount =
        d.due_transport_previous_months_count != null
          ? String(d.due_transport_previous_months_count)
          : "";
      const totalDue = d.due_amount ?? "";
      return `
        <div class="receipt-half fees-bill-wrap">
          <div class="bill-header-main">
            <div class="bill-logo-wrap">${logoBlock}</div>
            <div class="bill-header-text">
              <div class="bill-title-dari">${escapeHtml(
                template.dariBillTitle || defaultTemplate.dariBillTitle
              )}</div>
              <div class="bill-title-en">${escapeHtml(englishBillLine)}</div>
              <div class="bill-header-meta">
                <span>${escapeHtml(template.schoolAddress)}</span>
                <span>${escapeHtml(template.schoolPhone)}</span>
              </div>
              <div class="bill-period">
                <span class="bill-period-label">Month:</span> ${escapeHtml(monthLine)}
              </div>
            </div>
          </div>

          <table class="bill-table bill-meta" dir="ltr">
            <tbody>
              <tr>
                <th scope="row" class="bill-th">Name/اسم</th>
                <td class="bill-td" colspan="2">${escapeHtml(d.student_name)}</td>
                <th scope="row" class="bill-th">FatherName/اسم پدر</th>
                <td class="bill-td" colspan="2">${escapeHtml(d.father_name)}</td>
                <th scope="row" class="bill-th">Class/صنف</th>
                <td class="bill-td">${escapeHtml(classLabel)}</td>
              </tr>
              <tr>
                <td class="bill-td bill-col-note"></td>
                <td class="bill-td bill-amt" colspan="2">${escapeHtml(duePreviousBalance)}</td>
                <td class="bill-td bill-col-burj"></td>
                <td class="bill-td bill-col-subject" colspan="4">Previous year balance</td>
              </tr>
            </tbody>
          </table>

          <table class="bill-table bill-fees" dir="ltr">
            <thead>
              <tr>
                <th scope="col" class="bill-th bill-col-note">ملاحظه شد</th>
                <th scope="col" class="bill-th bill-col-amt" colspan="2">مبلغ قابل تادیه</th>
                <th scope="col" class="bill-th bill-col-burj">برج</th>
                <th scope="col" class="bill-th bill-col-subject" colspan="4">موضوع فیس</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="bill-td bill-col-note"></td>
                <td class="bill-td bill-amt" colspan="2">${escapeHtml(dueMonthlyCurr)}</td>
                <td class="bill-td bill-col-burj">${escapeHtml(burj)}</td>
                <td class="bill-td bill-col-subject" colspan="4">فیس پیش پرداخت برج</td>
              </tr>
              <tr>
                <td class="bill-td bill-col-note"></td>
                <td class="bill-td bill-amt" colspan="2">${escapeHtml(dueMonthlyPrev)}</td>
                <td class="bill-td bill-col-burj">${escapeHtml(burjMonthlyPrevCount)}</td>
                <td class="bill-td bill-col-subject" colspan="4">فیس باقیات برج/بروج </td>
              </tr>
              <tr>
                <td class="bill-td bill-col-note"></td>
                <td class="bill-td bill-amt" colspan="2">${escapeHtml(dueTransportCurr)}</td>
                <td class="bill-td bill-col-burj">${escapeHtml(burj)}</td>
                <td class="bill-td bill-col-subject" colspan="4">فیس ترانسپور\u067C</td>
              </tr>
              <tr>
                <td class="bill-td bill-col-note"></td>
                <td class="bill-td bill-amt" colspan="2">${escapeHtml(dueTransportPrev)}</td>
                <td class="bill-td bill-col-burj">${escapeHtml(burjTransportPrevCount)}</td>
                <td class="bill-td bill-col-subject" colspan="4">فیس باقیات ترانسپور\u067C</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="bill-tfoot-row">
                <td class="bill-td bill-amt bill-td-grand" colspan="3">${escapeHtml(totalDue)}</td>
                <td class="bill-th bill-td-jumlah">جمله شد</td>
                <td class="bill-td bill-td-paydate" colspan="4">تاریخ تادیه مبلغ:</td>
              </tr>
            </tfoot>
          </table>

          <div class="bill-footer-dari">${escapeHtml(template.dariBillFooterNote || defaultTemplate.dariBillFooterNote)}</div>
          <div class="bill-footer-en">${escapeHtml(template.thankYouMessage)}</div>
        </div>
      `;
    });

    const chunked = [];
    for (let i = 0; i < receipts.length; i += 3) {
      chunked.push(receipts.slice(i, i + 3));
    }

    const pagesHtml = chunked
      .map((group) => {
        const first = group[0] || `<div class="receipt-half empty"></div>`;
        const second = group[1] || `<div class="receipt-half empty"></div>`;
        const third = group[2] || `<div class="receipt-half empty"></div>`;
        return `
          <section class="a4-page">
            <div class="page-halves">
              ${first}
              <div class="cut-line"><span>Cut Here</span></div>
              ${second}
              <div class="cut-line"><span>Cut Here</span></div>
              ${third}
            </div>
          </section>
        `;
      })
      .join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)}</title>
          <style>
            @page { size: A4; margin: 7mm; }
            body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #0f172a; }
            .btn { padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5f5; background:#fff; cursor:pointer; font-weight:600; }
            .a4-page { page-break-after: always; }
            .page-halves {
              width: 100%;
              display: flex;
              flex-direction: column;
              gap: 5mm;
            }
            .cut-line {
              position: relative;
              height: 0;
              border-top: 1px dashed #64748b;
              margin: 1mm 0;
            }
            .cut-line span {
              position: absolute;
              top: -7px;
              left: 50%;
              transform: translateX(-50%);
              background: #fff;
              padding: 0 8px;
              font-size: 8px;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #64748b;
            }
            .receipt-half {
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 8px 10px;
              box-sizing: border-box;
              min-height: 0;
              display: flex;
              flex-direction: column;
              line-height: 1.1;
            }
            .receipt-half.empty { border-style: dashed; background: #f8fafc; }
            .fees-bill-wrap { line-height: 1.2; }
            .bill-header-main {
              display: flex;
              align-items: flex-start;
              gap: 10px;
              margin-bottom: 6px;
            }
            .bill-logo-wrap { flex: 0 0 auto; }
            .bill-logo-img { width: 42px; height: 42px; border-radius: 10px; object-fit: contain; display: block; }
            .bill-logo-fallback { width: 42px; height: 42px; display: block; }
            .bill-logo-fallback svg { width: 42px; height: 42px; display: block; }
            .bill-header-text { flex: 1; min-width: 0; }
            .bill-title-dari { font-size: 13px; font-weight: 800; margin: 0; text-align: right; direction: rtl; }
            .bill-title-en { font-size: 11px; font-weight: 600; margin: 2px 0 0; text-align: right; }
            .bill-header-meta {
              margin-top: 2px;
              display: flex;
              flex-direction: column;
              gap: 1px;
              font-size: 9px;
              color: #475569;
              text-align: right;
            }
            .bill-period { font-size: 9px; color: #475569; margin-top: 3px; text-align: right; }
            .bill-period-label { font-weight: 600; }
            .bill-table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 4px; }
            .bill-table th, .bill-table td { border: 1px solid #1e293b; padding: 4px 5px; vertical-align: middle; }
            .bill-th { background: #f1f5f9; font-weight: 600; }
            .bill-amt { text-align: center; font-weight: 600; }
            .bill-col-subject { direction: rtl; text-align: right; }
            .bill-col-burj { text-align: center; min-width: 3.5rem; }
            .bill-td-grand { font-size: 12px; font-weight: 800; }
            .bill-td-paydate { min-height: 1.2rem; vertical-align: top; }
            .bill-td-jumlah { text-align: center; white-space: nowrap; }
            .bill-footer-dari { margin-top: 6px; font-size: 8px; line-height: 1.25; text-align: justify; direction: rtl; }
            .bill-footer-en { margin-top: 4px; font-size: 8px; color: #64748b; text-align: center; }
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
    setSavingClass(true);
    try {
      await apiFetch(editingClassId ? `/classes/${editingClassId}/` : "/classes/", {
        method: editingClassId ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setForm(emptyClass);
      setEditingClassId(null);
      await loadClasses();
    } catch (err) {
      setError(err.message || `Failed to ${editingClassId ? "update" : "create"} class.`);
    } finally {
      setSavingClass(false);
    }
  };

  const onEditClass = (cls) => {
    setEditingClassId(cls.id);
    setForm({
      name: cls.name || "",
      year_shamsi: cls.year_shamsi || "",
      monthly_fee: cls.monthly_fee || "",
      transport_fee: cls.transport_fee || "",
      uniform_fee: cls.uniform_fee || "",
      book_fee: cls.book_fee || "",
    });
  };

  const onDeleteClass = async (cls) => {
    if (!window.confirm(`Delete class "${cls.name}" (${cls.year_shamsi})?`)) return;
    setError("");
    try {
      await apiFetch(`/classes/${cls.id}/`, { method: "DELETE" });
      if (editingClassId === cls.id) {
        setEditingClassId(null);
        setForm(emptyClass);
      }
      await loadClasses(classesPage);
    } catch (err) {
      setError(err.message || "Failed to delete class.");
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
            <h3>{editingClassId ? "Edit Class" : "New Class"}</h3>
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
              <button className="button button-primary" type="submit" disabled={savingClass}>
                {savingClass ? "Saving..." : editingClassId ? "Update Class" : "Save Class"}
              </button>
              {editingClassId ? (
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() => {
                    setEditingClassId(null);
                    setForm(emptyClass);
                  }}
                >
                  Cancel Edit
                </button>
              ) : null}
            </form>
            {loadingClasses ? <div className="status-message">Loading classes...</div> : null}
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
                <div>Actions</div>
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
                  <div className="inline-actions">
                    <button className="button button-outline" type="button" onClick={() => onEditClass(cls)}>
                      Edit
                    </button>
                    <button className="button button-outline" type="button" onClick={() => onDeleteClass(cls)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {!loadingClasses && classes.length === 0 ? (
              <div className="muted-panel" style={{ marginTop: 12 }}>
                No data found.
              </div>
            ) : null}
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
          <p className="muted-panel" style={{ marginTop: 4, marginBottom: 12 }}>
            {buildMonthShamsi() ? (
              <>
                Reference month: {formatMonthShamsiWithNames(buildMonthShamsi())}. Baqiāt (remaining) fees are
                cumulative from month 01 (حمل) of that Shamsi year through this month: for each month, tuition
                and transport due are (class rate minus payments recorded for that Shamsi month), then summed.
                {duesPeriodSummary &&
                duesPeriodSummary.through === buildMonthShamsi() &&
                !duesLoading ? (
                  <>
                    {" "}
                    Last loaded: {duesPeriodSummary.monthsCount} month(s) (
                    {duesPeriodSummary.from} → {duesPeriodSummary.through}).
                  </>
                ) : null}
              </>
            ) : (
              "Enter year and month. Month names are Shamsi (Dari)."
            )}
          </p>
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
                {SHAMSI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.value} — {m.dari} {m.latin}
                  </option>
                ))}
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
                <div className="due-card-title">Monthly & transport due</div>
                <div className="due-card-row">
                  <span className="due-card-label">Student</span>
                  <span>{d.student_name}</span>
                </div>
                <div className="due-card-row">
                  <span className="due-card-label">Father</span>
                  <span>{d.father_name}</span>
                </div>
                <div className="due-card-row">
                  <span className="due-card-label">Class</span>
                  <span>
                    {d.class_name} ({d.class_year_shamsi})
                  </span>
                </div>
                <div className="due-card-row">
                  <span className="due-card-label">Due monthly</span>
                  <span>{d.due_monthly_fee}</span>
                </div>
                <div className="due-card-row">
                  <span className="due-card-label">Due transport</span>
                  <span>{d.due_transport_fee}</span>
                </div>
                <div className="due-card-row">
                  <span className="due-card-label">Previous balance</span>
                  <span>{d.due_previous_balance || "0.00"}</span>
                </div>
                <div className="due-card-row due-card-total">
                  <span className="due-card-label">Total due</span>
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
