import { useState } from "react";
import { apiFetch } from "../api.js";
import Field from "../components/Field.jsx";
import StatCard from "../components/StatCard.jsx";

const defaultFilters = {
  period: "month",
  date: "",
  start: "",
  end: "",
  includeItems: true,
};

export default function Reports() {
  const RECEIPT_TEMPLATE_KEY = "receipt_template_config_v1";
  const defaultTemplate = {
    schoolName: "Watan Oxford High School",
    schoolAddress: "School Address (Update Later)",
    schoolPhone: "0700 000 000",
    thankYouMessage: "Thank you for your attention and timely payment.",
    logoDataUrl: "",
  };
  const [filters, setFilters] = useState(defaultFilters);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loadingReport, setLoadingReport] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
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
          <p>Revenue, expenses, and profit with flexible date ranges.</p>
        </div>
        {activeTab === "summary" ? (
          <button className="button button-primary" onClick={fetchReport} disabled={loadingReport}>
            {loadingReport ? "Generating..." : "Generate Report"}
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
      </>
      ) : (
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
      )}
    </div>
  );
}
