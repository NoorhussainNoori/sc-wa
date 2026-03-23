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
  const [loadingSummary, setLoadingSummary] = useState(false);

  const payments = Array.isArray(summary?.payments) ? summary.payments : [];
  const expenses = Array.isArray(summary?.expenses) ? summary.expenses : [];
  const totalRevenue = Number(summary?.total_revenue || 0);
  const totalExpenses = Number(summary?.total_expenses || 0);
  const profit = Number(summary?.profit || 0);
  const netMargin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : "0.0";
  const avgPayment = payments.length ? (totalRevenue / payments.length).toFixed(2) : "0.00";
  const avgExpense = expenses.length ? (totalExpenses / expenses.length).toFixed(2) : "0.00";

  const topFeeType = Object.entries(
    payments.reduce((acc, item) => {
      const key = item.fee_type_name || item.fee_type || "Unknown";
      acc[key] = (acc[key] || 0) + Number(item.amount || 0);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];

  const topExpenseCategory = Object.entries(
    expenses.reduce((acc, item) => {
      const key = item.category_name || item.category || "Unknown";
      acc[key] = (acc[key] || 0) + Number(item.amount || 0);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];

  const recentPayments = payments.slice(0, 5);
  const recentExpenses = expenses.slice(0, 5);

  const onChange = (field) => (event) => {
    setFilters((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const fetchSummary = async () => {
    setError("");
    setLoadingSummary(true);
    try {
      const params = new URLSearchParams();
      params.set("period", filters.period);
      if (filters.period === "custom") {
        if (filters.start) params.set("start", filters.start);
        if (filters.end) params.set("end", filters.end);
      } else if (filters.date) {
        params.set("date", filters.date);
      }
      params.set("include_items", "1");
      const data = await apiFetch(`/reports/summary/?${params.toString()}`);
      setSummary(data);
    } catch (err) {
      setError(err.message || "Failed to load summary.");
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      setError("");
      setLoadingSummary(true);
      try {
        const params = new URLSearchParams();
        params.set("period", defaultFilters.period);
        params.set("include_items", "1");
        const data = await apiFetch(`/reports/summary/?${params.toString()}`);
        setSummary(data);
      } catch (err) {
        setError(err.message || "Failed to load summary.");
      } finally {
        setLoadingSummary(false);
      }
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
        <button className="button button-primary" onClick={fetchSummary} disabled={loadingSummary}>
          {loadingSummary ? "Loading..." : "Refresh"}
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
        <button className="button button-outline" onClick={fetchSummary} disabled={loadingSummary}>
          {loadingSummary ? "Applying..." : "Apply Filters"}
        </button>
        {loadingSummary ? <div className="status-message">Loading summary...</div> : null}
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
        <StatCard
          label="Transactions"
          value={summary ? payments.length : "—"}
          hint="Total payment records"
        />
        <StatCard
          label="Expense Entries"
          value={summary ? expenses.length : "—"}
          hint="Total expense records"
        />
        <StatCard
          label="Avg Payment"
          value={summary ? avgPayment : "—"}
          hint="Revenue / transactions"
        />
        <StatCard
          label="Net Margin"
          value={summary ? `${netMargin}%` : "—"}
          hint="Profit as % of revenue"
        />
      </div>

      {summary ? (
        <div className="stats-grid">
          <div className="panel">
            <h3>Performance Insights</h3>
            <div className="kpi-list">
              <div className="kpi-line">
                <span>Top Fee Type</span>
                <strong>{topFeeType ? `${topFeeType[0]} (${topFeeType[1].toFixed(2)})` : "No data found"}</strong>
              </div>
              <div className="kpi-line">
                <span>Top Expense Category</span>
                <strong>
                  {topExpenseCategory
                    ? `${topExpenseCategory[0]} (${topExpenseCategory[1].toFixed(2)})`
                    : "No data found"}
                </strong>
              </div>
              <div className="kpi-line">
                <span>Avg Expense</span>
                <strong>{avgExpense}</strong>
              </div>
              <div className="kpi-line">
                <span>Financial Health</span>
                <strong className={profit >= 0 ? "kpi-good" : "kpi-bad"}>
                  {profit >= 0 ? "Positive" : "Negative"}
                </strong>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Recent Payments</h3>
            {recentPayments.length ? (
              <div className="mini-list">
                {recentPayments.map((item) => (
                  <div className="mini-list-row" key={`pay-${item.id}`}>
                    <span>{item.student_name || "Student"}</span>
                    <span>{item.fee_type_name || "Type"}</span>
                    <strong>{item.amount}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted-panel">No data found.</div>
            )}
          </div>

          <div className="panel">
            <h3>Recent Expenses</h3>
            {recentExpenses.length ? (
              <div className="mini-list">
                {recentExpenses.map((item) => (
                  <div className="mini-list-row" key={`exp-${item.id}`}>
                    <span>{item.category_name || "Category"}</span>
                    <span>{item.paid_by || "—"}</span>
                    <strong>{item.amount}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted-panel">No data found.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
