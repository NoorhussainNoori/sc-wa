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
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [error, setError] = useState("");
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  const loadCategories = async () => {
    try {
      const data = await apiFetch("/expense-categories/?page_size=100");
      setCategories(extractListData(data));
    } catch (err) {
      setError(err.message || "Failed to load categories.");
    }
  };

  const loadExpenses = async (page = 1) => {
    setLoadingExpenses(true);
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
    } finally {
      setLoadingExpenses(false);
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
    setSavingCategory(true);
    try {
      await apiFetch("/expense-categories/", {
        method: "POST",
        body: JSON.stringify({ name: categoryName }),
      });
      setCategoryName("");
      await loadCategories();
    } catch (err) {
      setError(err.message || "Failed to create category.");
    } finally {
      setSavingCategory(false);
    }
  };

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSavingExpense(true);
    try {
      await apiFetch(editingExpenseId ? `/expenses/${editingExpenseId}/` : "/expenses/", {
        method: editingExpenseId ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setForm(emptyExpense);
      setEditingExpenseId(null);
      await loadExpenses(expensesPage);
    } catch (err) {
      setError(err.message || `Failed to ${editingExpenseId ? "update" : "save"} expense.`);
    } finally {
      setSavingExpense(false);
    }
  };

  const onEditExpense = (expense) => {
    setEditingExpenseId(expense.id);
    setForm({
      category: expense.category || "",
      amount: expense.amount || "",
      date_shamsi: expense.date_shamsi || "",
      paid_by: expense.paid_by || "",
      description: expense.description || "",
    });
  };

  const onDeleteExpense = async (expense) => {
    if (!window.confirm(`Delete expense #${expense.id}?`)) return;
    setError("");
    try {
      await apiFetch(`/expenses/${expense.id}/`, { method: "DELETE" });
      if (editingExpenseId === expense.id) {
        setEditingExpenseId(null);
        setForm(emptyExpense);
      }
      await loadExpenses(expensesPage);
    } catch (err) {
      setError(err.message || "Failed to delete expense.");
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
          <button className="button button-outline" onClick={createCategory} disabled={savingCategory}>
            {savingCategory ? "Adding..." : "Add Category"}
          </button>
        </div>
        <div className="pill-list">
          {categories.map((category) => (
            <span key={category.id} className="pill pill-muted">
              {category.name}
            </span>
          ))}
        </div>
        {categories.length === 0 ? (
          <div className="muted-panel" style={{ marginTop: 12 }}>
            No categories found.
          </div>
        ) : null}
      </div>

      <div className="panel">
        <h3>{editingExpenseId ? "Edit Expense" : "New Expense"}</h3>
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
          <button className="button button-primary" type="submit" disabled={savingExpense}>
            {savingExpense ? "Saving..." : editingExpenseId ? "Update Expense" : "Save Expense"}
          </button>
          {editingExpenseId ? (
            <button
              className="button button-outline"
              type="button"
              onClick={() => {
                setEditingExpenseId(null);
                setForm(emptyExpense);
              }}
            >
              Cancel Edit
            </button>
          ) : null}
        </form>
        {loadingExpenses ? <div className="status-message">Loading expenses...</div> : null}
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
            <div>Actions</div>
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
                <div className="inline-actions">
                  <button className="button button-outline" type="button" onClick={() => onEditExpense(expense)}>
                    Edit
                  </button>
                  <button className="button button-outline" type="button" onClick={() => onDeleteExpense(expense)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {!loadingExpenses && expenses.length === 0 ? (
          <div className="muted-panel" style={{ marginTop: 12 }}>
            No data found.
          </div>
        ) : null}
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
