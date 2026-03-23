import { useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import StatCard from "../components/StatCard.jsx";
import Field from "../components/Field.jsx";

const defaultFilters = {
  period: "month",
  date: "",
  start: "",
  end: "",
};

export default function Dashboard() {
  const [filters, setFilters] = useState(defaultFilters);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  const onChange = (field) => (event) => {
    setFilters((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const fetchSummary = async () => {
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("period", filters.period);
      if (filters.period === "custom") {
        if (filters.start) params.set("start", filters.start);
        if (filters.end) params.set("end", filters.end);
      } else if (filters.date) {
        params.set("date", filters.date);
      }
      const data = await apiFetch(`/reports/summary/?${params.toString()}`);
      setSummary(data);
    } catch (err) {
      setError(err.message || "Failed to load summary.");
    }
  };

  useEffect(() => {
    const run = async () => {
      await fetchSummary();
    };
    void run();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Quick totals and profit overview.</p>
        </div>
        <button className="button button-primary" onClick={fetchSummary}>
          Refresh
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
                <input
                  className="input"
                  value={filters.start}
                  onChange={onChange("start")}
                  placeholder="1404-01-01"
                />
              </Field>
              <Field label="End (Shamsi YYYY-MM-DD)">
                <input
                  className="input"
                  value={filters.end}
                  onChange={onChange("end")}
                  placeholder="1404-01-30"
                />
              </Field>
            </>
          ) : (
            <Field label={`Date (${filters.period})`}>
              <input
                className="input"
                value={filters.date}
                onChange={onChange("date")}
                placeholder={filters.period === "day" ? "1404-01-15" : filters.period === "month" ? "1404-01" : "1404"}
              />
            </Field>
          )}
        </div>
        <button className="button button-outline" onClick={fetchSummary}>
          Apply Filters
        </button>
        {error ? <div className="form-error">{error}</div> : null}
      </div>

      <div className="stats-grid">
        <StatCard
          label="Total Revenue"
          value={summary ? summary.total_revenue : "—"}
          hint="All payments"
        />
        <StatCard
          label="Total Expenses"
          value={summary ? summary.total_expenses : "—"}
          hint="All expense records"
        />
        <StatCard
          label="Profit"
          value={summary ? summary.profit : "—"}
          hint="Revenue - Expenses"
        />
      </div>
    </div>
  );
}
