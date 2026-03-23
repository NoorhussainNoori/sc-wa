import { useEffect, useState } from "react";
import { apiFetch, extractListData, extractPaginationMeta } from "../api.js";
import Field from "../components/Field.jsx";
import PaginationControls from "../components/PaginationControls.jsx";

const emptyExpense = {
  category: "",
  amount: "",
  date_shamsi: "",
  paid_by: "",
  description: "",
};

export default function Expenses() {
  const PAGE_SIZE = 10;
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expensesPage, setExpensesPage] = useState(1);
  const [expensesMeta, setExpensesMeta] = useState({
    count: 0,
    next: null,
    previous: null,
  });
  const [categoryName, setCategoryName] = useState("");
  const [form, setForm] = useState(emptyExpense);
  const [error, setError] = useState("");

  const loadCategories = async () => {
    try {
      const data = await apiFetch("/expense-categories/?page_size=100");
      setCategories(extractListData(data));
    } catch (err) {
      setError(err.message || "Failed to load categories.");
    }
  };

  const loadExpenses = async (page = 1) => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      const data = await apiFetch(`/expenses/?${params.toString()}`);
      setExpenses(extractListData(data));
      setExpensesMeta(extractPaginationMeta(data));
      setExpensesPage(page);
    } catch (err) {
      setError(err.message || "Failed to load expenses.");
    }
  };

  useEffect(() => {
    const run = async () => {
      await Promise.all([loadCategories(), loadExpenses()]);
    };
    void run();
  }, []);

  const createCategory = async () => {
    setError("");
    if (!categoryName.trim()) return;
    try {
      await apiFetch("/expense-categories/", {
        method: "POST",
        body: JSON.stringify({ name: categoryName }),
      });
      setCategoryName("");
      await loadCategories();
    } catch (err) {
      setError(err.message || "Failed to create category.");
    }
  };

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/expenses/", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(emptyExpense);
      await loadExpenses(expensesPage);
    } catch (err) {
      setError(err.message || "Failed to save expense.");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Expenses</h2>
          <p>Record salaries, office expenses, and custom categories.</p>
        </div>
      </div>

      <div className="panel">
        <h3>Expense Categories</h3>
        <div className="inline-actions">
          <input
            className="input"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder="New category name"
          />
          <button className="button button-outline" onClick={createCategory}>
            Add Category
          </button>
        </div>
        <div className="pill-list">
          {categories.map((category) => (
            <span key={category.id} className="pill pill-muted">
              {category.name}
            </span>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>New Expense</h3>
        <form className="form-grid" onSubmit={onSubmit}>
          <Field label="Category">
            <select className="input" value={form.category} onChange={onChange("category")} required>
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input className="input" value={form.amount} onChange={onChange("amount")} required />
          </Field>
          <Field label="Shamsi Date (YYYY-MM-DD)">
            <input
              className="input"
              value={form.date_shamsi}
              onChange={onChange("date_shamsi")}
              placeholder="1404-01-10"
              required
            />
          </Field>
          <Field label="Paid By">
            <input className="input" value={form.paid_by} onChange={onChange("paid_by")} required />
          </Field>
          <Field label="Description">
            <input
              className="input"
              value={form.description}
              onChange={onChange("description")}
              placeholder="Optional details"
            />
          </Field>
          <button className="button button-primary" type="submit">
            Save Expense
          </button>
        </form>
        {error ? <div className="form-error">{error}</div> : null}
      </div>

      <div className="panel">
        <h3>Expense List</h3>
        <div className="table">
          <div className="table-head">
            <div>ID</div>
            <div>Category</div>
            <div>Amount</div>
            <div>Date</div>
            <div>Paid By</div>
            <div>Description</div>
          </div>
          {expenses.map((expense) => {
            const categoryEntry = categories.find((cat) => cat.id === expense.category);
            return (
              <div className="table-row" key={expense.id}>
                <div>{expense.id}</div>
                <div>{categoryEntry ? categoryEntry.name : expense.category}</div>
                <div>{expense.amount}</div>
                <div>{expense.date_shamsi}</div>
                <div>{expense.paid_by}</div>
                <div>{expense.description || "—"}</div>
              </div>
            );
          })}
        </div>
        <PaginationControls
          count={expensesMeta.count}
          currentPage={expensesPage}
          pageSize={PAGE_SIZE}
          hasPrevious={Boolean(expensesMeta.previous)}
          hasNext={Boolean(expensesMeta.next)}
          onPrevious={() => loadExpenses(Math.max(1, expensesPage - 1))}
          onNext={() => loadExpenses(expensesPage + 1)}
        />
      </div>
    </div>
  );
}
