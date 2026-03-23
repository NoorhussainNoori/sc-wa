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
  const [filters, setFilters] = useState(defaultFilters);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Reports</h2>
          <p>Revenue, expenses, and profit with flexible date ranges.</p>
        </div>
        <button className="button button-primary" onClick={fetchReport}>
          Generate Report
        </button>
      </div>

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
                <div>{payment.student}</div>
                <div>{payment.fee_type}</div>
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
                <div>{expense.category}</div>
                <div>{expense.amount}</div>
                <div>{expense.date_shamsi}</div>
                <div>{expense.paid_by}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
