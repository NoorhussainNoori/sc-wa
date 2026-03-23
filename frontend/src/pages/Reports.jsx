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
  const [activeTab, setActiveTab] = useState("summary");
  const [templateStatus, setTemplateStatus] = useState("");
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
    localStorage.setItem(RECEIPT_TEMPLATE_KEY, JSON.stringify(template));
    setTemplateStatus("Receipt template saved.");
  };

  const clearLogo = () => {
    setTemplate((prev) => ({ ...prev, logoDataUrl: "" }));
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Reports</h2>
          <p>Revenue, expenses, and profit with flexible date ranges.</p>
        </div>
        {activeTab === "summary" ? (
          <button className="button button-primary" onClick={fetchReport}>
            Generate Report
          </button>
        ) : (
          <button className="button button-primary" onClick={saveTemplate}>
            Save Template
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
        </div>
      ) : null}

      {summary?.expenses ? (
        <div className="panel">
          <h3>Expense Details</h3>
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
              <button className="button button-primary" type="button" onClick={saveTemplate}>
                Save Template
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
