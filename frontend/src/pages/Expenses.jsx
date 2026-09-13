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
  const [categoryActive, setCategoryActive] = useState(true);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [form, setForm] = useState(emptyExpense);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [error, setError] = useState("");
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [activeTab, setActiveTab] = useState("expenses");

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

  const resetCategoryForm = () => {
    setCategoryName("");
    setCategoryActive(true);
    setEditingCategoryId(null);
  };

  const saveCategory = async () => {
    setError("");
    if (!categoryName.trim()) {
      setError("Category name is required.");
      return;
    }
    setSavingCategory(true);
    try {
      await apiFetch(editingCategoryId ? `/expense-categories/${editingCategoryId}/` : "/expense-categories/", {
        method: editingCategoryId ? "PUT" : "POST",
        body: JSON.stringify({
          name: categoryName.trim(),
          is_active: categoryActive,
        }),
      });
      resetCategoryForm();
      await loadCategories();
    } catch (err) {
      setError(err.message || `Failed to ${editingCategoryId ? "update" : "create"} category.`);
    } finally {
      setSavingCategory(false);
    }
  };

  const onEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setCategoryName(category.name || "");
    setCategoryActive(category.is_active !== false);
    setError("");
  };

  const onDeleteCategory = async (category) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    setError("");
    try {
      await apiFetch(`/expense-categories/${category.id}/`, { method: "DELETE" });
      if (editingCategoryId === category.id) {
        resetCategoryForm();
      }
      if (String(form.category) === String(category.id)) {
        setForm((prev) => ({ ...prev, category: "" }));
      }
      await loadCategories();
    } catch (err) {
      const detail = err.message || "";
      if (/protected|referenced|constraint|Cannot delete/i.test(detail)) {
        setError(
          `Cannot delete "${category.name}" because expenses still use it. Remove or reassign those expenses first, or mark the category inactive.`
        );
      } else {
        setError(detail || "Failed to delete category.");
      }
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

  const activeCategories = categories.filter((category) => category.is_active !== false);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Expenses</h2>
          <p>
            {activeTab === "expenses"
              ? "Record salaries, office expenses, and other school spending."
              : "Add, edit, or remove expense categories."}
          </p>
        </div>
      </div>

      <div className="inline-actions">
        <button
          className={activeTab === "expenses" ? "button button-primary" : "button button-outline"}
          type="button"
          onClick={() => setActiveTab("expenses")}
        >
          Expenses
        </button>
        <button
          className={activeTab === "categories" ? "button button-primary" : "button button-outline"}
          type="button"
          onClick={() => setActiveTab("categories")}
        >
          Categories
        </button>
      </div>

      {activeTab === "expenses" ? (
        <>
          <div className="panel">
            <h3>{editingExpenseId ? "Edit Expense" : "New Expense"}</h3>
            <form className="form-grid" onSubmit={onSubmit}>
              <Field label="Category">
                <select className="input" value={form.category} onChange={onChange("category")} required>
                  <option value="">Select category</option>
                  {(editingExpenseId ? categories : activeCategories).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {category.is_active === false ? " (inactive)" : ""}
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
            {activeCategories.length === 0 ? (
              <div className="muted-panel" style={{ marginTop: 12 }}>
                No active categories yet. Open the Categories tab to add one.
              </div>
            ) : null}
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
                    <div>{categoryEntry ? categoryEntry.name : expense.category_name || expense.category}</div>
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
        </>
      ) : null}

      {activeTab === "categories" ? (
        <div className="panel">
          <h3>{editingCategoryId ? "Edit Category" : "Expense Categories"}</h3>
          <div className="inline-actions" style={{ flexWrap: "wrap", gap: 8 }}>
            <input
              className="input"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Category name"
            />
            <label className="inline-actions" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={categoryActive}
                onChange={(event) => setCategoryActive(event.target.checked)}
              />
              Active
            </label>
            <button className="button button-outline" type="button" onClick={saveCategory} disabled={savingCategory}>
              {savingCategory ? "Saving..." : editingCategoryId ? "Update Category" : "Add Category"}
            </button>
            {editingCategoryId ? (
              <button className="button button-outline" type="button" onClick={resetCategoryForm}>
                Cancel Edit
              </button>
            ) : null}
          </div>

          {error ? <div className="form-error" style={{ marginTop: 12 }}>{error}</div> : null}

          <div className="table" style={{ marginTop: 16 }}>
            <div className="table-head">
              <div>ID</div>
              <div>Name</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            {categories.map((category) => (
              <div className="table-row" key={category.id}>
                <div>{category.id}</div>
                <div>{category.name}</div>
                <div>{category.is_active === false ? "Inactive" : "Active"}</div>
                <div className="inline-actions">
                  <button className="button button-outline" type="button" onClick={() => onEditCategory(category)}>
                    Edit
                  </button>
                  <button className="button button-outline" type="button" onClick={() => onDeleteCategory(category)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          {categories.length === 0 ? (
            <div className="muted-panel" style={{ marginTop: 12 }}>
              No categories found.
            </div>
          ) : null}
          <div className="muted-panel" style={{ marginTop: 12 }}>
            If a category already has expenses, delete may be blocked. Mark it inactive instead, or delete/reassign those
            expenses first.
          </div>
        </div>
      ) : null}
    </div>
  );
}

