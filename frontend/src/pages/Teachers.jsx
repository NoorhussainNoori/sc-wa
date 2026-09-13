import { useEffect, useState } from "react";
import { apiFetch, extractListData, extractPaginationMeta } from "../api.js";
import Field from "../components/Field.jsx";
import PaginationControls from "../components/PaginationControls.jsx";

const emptyTeacher = {
  name: "",
  father_name: "",
  phone: "",
  email: "",
  address: "",
  salary: "",
  department: "",
};

const emptySalaryPayment = {
  date_shamsi: "",
  amount: "",
  notes: "",
};

export default function Teachers() {
  const PAGE_SIZE = 10;
  const [activeTab, setActiveTab] = useState("teachers");
  const [teachers, setTeachers] = useState([]);
  const [teachersPage, setTeachersPage] = useState(1);
  const [teachersMeta, setTeachersMeta] = useState({
    count: 0,
    next: null,
    previous: null,
  });
  const [teacherSearch, setTeacherSearch] = useState("");
  const [form, setForm] = useState(emptyTeacher);
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [error, setError] = useState("");
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [savingTeacher, setSavingTeacher] = useState(false);

  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [paymentTeacherSearch, setPaymentTeacherSearch] = useState("");
  const [paymentTeachers, setPaymentTeachers] = useState([]);
  const [paymentTeachersPage, setPaymentTeachersPage] = useState(1);
  const [paymentTeachersMeta, setPaymentTeachersMeta] = useState({
    count: 0,
    next: null,
    previous: null,
  });
  const [hasSearchedPaymentTeachers, setHasSearchedPaymentTeachers] = useState(false);
  const [searchingPaymentTeachers, setSearchingPaymentTeachers] = useState(false);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [salaryPaymentsPage, setSalaryPaymentsPage] = useState(1);
  const [salaryPaymentsMeta, setSalaryPaymentsMeta] = useState({
    count: 0,
    next: null,
    previous: null,
  });
  const [salaryPaymentForm, setSalaryPaymentForm] = useState(emptySalaryPayment);
  const [loadingSalaryPayments, setLoadingSalaryPayments] = useState(false);
  const [savingSalaryPayment, setSavingSalaryPayment] = useState(false);

  const loadTeachers = async (query = teacherSearch, page = 1) => {
    setLoadingTeachers(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      const trimmed = String(query || "").trim();
      if (trimmed) params.set("q", trimmed);
      const data = await apiFetch(`/teachers/?${params.toString()}`);
      setTeachers(extractListData(data));
      setTeachersMeta(extractPaginationMeta(data));
      setTeachersPage(page);
    } catch (err) {
      setError(err.message || "Failed to load teachers.");
    } finally {
      setLoadingTeachers(false);
    }
  };

  const searchPaymentTeachers = async (page = 1) => {
    setError("");
    setSearchingPaymentTeachers(true);
    setHasSearchedPaymentTeachers(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      const trimmed = String(paymentTeacherSearch || "").trim();
      if (trimmed) params.set("q", trimmed);
      const data = await apiFetch(`/teachers/?${params.toString()}`);
      setPaymentTeachers(extractListData(data));
      setPaymentTeachersMeta(extractPaginationMeta(data));
      setPaymentTeachersPage(page);
    } catch (err) {
      setError(err.message || "Failed to search teachers.");
    } finally {
      setSearchingPaymentTeachers(false);
    }
  };

  const loadSalaryPayments = async (teacherId, page = 1) => {
    if (!teacherId) return;
    setLoadingSalaryPayments(true);
    try {
      const params = new URLSearchParams({
        teacher_id: String(teacherId),
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      const data = await apiFetch(`/teacher-salary-payments/?${params.toString()}`);
      setSalaryPayments(extractListData(data));
      setSalaryPaymentsMeta(extractPaginationMeta(data));
      setSalaryPaymentsPage(page);
    } catch (err) {
      setError(err.message || "Failed to load salary payments.");
    } finally {
      setLoadingSalaryPayments(false);
    }
  };

  useEffect(() => {
    void loadTeachers("", 1);
  }, []);

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSavingTeacher(true);
    try {
      await apiFetch(editingTeacherId ? `/teachers/${editingTeacherId}/` : "/teachers/", {
        method: editingTeacherId ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setForm(emptyTeacher);
      setEditingTeacherId(null);
      await loadTeachers(teacherSearch, teachersPage);
      if (hasSearchedPaymentTeachers) {
        await searchPaymentTeachers(paymentTeachersPage);
      }
    } catch (err) {
      setError(err.message || `Failed to ${editingTeacherId ? "update" : "create"} teacher.`);
    } finally {
      setSavingTeacher(false);
    }
  };

  const onEditTeacher = (teacher) => {
    setEditingTeacherId(teacher.id);
    setForm({
      name: teacher.name || "",
      father_name: teacher.father_name || "",
      phone: teacher.phone || "",
      email: teacher.email || "",
      address: teacher.address || "",
      salary: teacher.salary || "",
      department: teacher.department || "",
    });
    setActiveTab("teachers");
  };

  const onDeleteTeacher = async (teacher) => {
    if (!window.confirm(`Delete teacher "${teacher.name}"?`)) return;
    setError("");
    try {
      await apiFetch(`/teachers/${teacher.id}/`, { method: "DELETE" });
      if (editingTeacherId === teacher.id) {
        setEditingTeacherId(null);
        setForm(emptyTeacher);
      }
      if (selectedTeacher?.id === teacher.id) {
        clearSelectedTeacher();
      }
      await loadTeachers(teacherSearch, teachersPage);
      if (hasSearchedPaymentTeachers) {
        await searchPaymentTeachers(paymentTeachersPage);
      }
    } catch (err) {
      setError(err.message || "Failed to delete teacher.");
    }
  };

  const clearSelectedTeacher = () => {
    setSelectedTeacher(null);
    setSalaryPayments([]);
    setSalaryPaymentsMeta({ count: 0, next: null, previous: null });
    setSalaryPaymentsPage(1);
    setSalaryPaymentForm(emptySalaryPayment);
  };

  const onSelectTeacherForPayment = (teacher) => {
    setSelectedTeacher(teacher);
    setSalaryPaymentForm({
      date_shamsi: "",
      amount: teacher.salary || "",
      notes: "",
    });
    setError("");
    void loadSalaryPayments(teacher.id, 1);
  };

  const onSalaryPaymentChange = (field) => (event) => {
    setSalaryPaymentForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const onSalaryPaymentSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTeacher) {
      setError("Select a teacher first.");
      return;
    }
    if (!salaryPaymentForm.date_shamsi || !salaryPaymentForm.amount) {
      setError("Date and amount are required.");
      return;
    }
    setError("");
    setSavingSalaryPayment(true);
    try {
      await apiFetch("/teacher-salary-payments/", {
        method: "POST",
        body: JSON.stringify({
          teacher: selectedTeacher.id,
          date_shamsi: salaryPaymentForm.date_shamsi,
          amount: salaryPaymentForm.amount,
          notes: salaryPaymentForm.notes || "",
        }),
      });
      setSalaryPaymentForm({
        date_shamsi: "",
        amount: selectedTeacher.salary || "",
        notes: "",
      });
      await loadSalaryPayments(selectedTeacher.id, 1);
    } catch (err) {
      setError(err.message || "Failed to save salary payment.");
    } finally {
      setSavingSalaryPayment(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Teachers</h2>
          <p>
            {activeTab === "teachers"
              ? "Register teachers and set their salary. Search and page through the list."
              : "Search a teacher, select them, then record salary payments."}
          </p>
        </div>
      </div>

      <div className="inline-actions">
        <button
          className={activeTab === "teachers" ? "button button-primary" : "button button-outline"}
          type="button"
          onClick={() => setActiveTab("teachers")}
        >
          Teacher setup
        </button>
        <button
          className={activeTab === "payments" ? "button button-primary" : "button button-outline"}
          type="button"
          onClick={() => {
            setActiveTab("payments");
            setError("");
          }}
        >
          Teacher payments
        </button>
      </div>

      {activeTab === "teachers" ? (
        <>
          <div className="panel">
            <h3>{editingTeacherId ? "Edit Teacher" : "New Teacher"}</h3>
            <form className="form-grid" onSubmit={onSubmit}>
              <Field label="Name">
                <input className="input" value={form.name} onChange={onChange("name")} required />
              </Field>
              <Field label="Father Name">
                <input className="input" value={form.father_name} onChange={onChange("father_name")} required />
              </Field>
              <Field label="Phone">
                <input className="input" value={form.phone} onChange={onChange("phone")} required />
              </Field>
              <Field label="Email">
                <input className="input" value={form.email} onChange={onChange("email")} required />
              </Field>
              <Field label="Address">
                <input className="input" value={form.address} onChange={onChange("address")} required />
              </Field>
              <Field label="Salary">
                <input className="input" value={form.salary} onChange={onChange("salary")} required />
              </Field>
              <Field label="Department">
                <input className="input" value={form.department} onChange={onChange("department")} required />
              </Field>
              <button className="button button-primary" type="submit" disabled={savingTeacher}>
                {savingTeacher ? "Saving..." : editingTeacherId ? "Update Teacher" : "Save Teacher"}
              </button>
              {editingTeacherId ? (
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() => {
                    setEditingTeacherId(null);
                    setForm(emptyTeacher);
                  }}
                >
                  Cancel Edit
                </button>
              ) : null}
            </form>
            {error ? <div className="form-error">{error}</div> : null}
          </div>

          <div className="panel">
            <h3>Teacher List</h3>
            <div className="inline-actions" style={{ marginBottom: 12 }}>
              <input
                className="input"
                value={teacherSearch}
                onChange={(event) => setTeacherSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void loadTeachers(teacherSearch, 1);
                  }
                }}
                placeholder="Search name, father, phone, email, department..."
              />
              <button
                className="button button-outline"
                type="button"
                onClick={() => loadTeachers(teacherSearch, 1)}
                disabled={loadingTeachers}
              >
                {loadingTeachers ? "Searching..." : "Search"}
              </button>
              {teacherSearch ? (
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() => {
                    setTeacherSearch("");
                    void loadTeachers("", 1);
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
            {loadingTeachers ? <div className="status-message">Loading teachers...</div> : null}
            <div className="table">
              <div className="table-head">
                <div>ID</div>
                <div>Name</div>
                <div>Father</div>
                <div>Phone</div>
                <div>Email</div>
                <div>Department</div>
                <div>Salary</div>
                <div>Actions</div>
              </div>
              {teachers.map((teacher) => (
                <div className="table-row" key={teacher.id}>
                  <div>{teacher.id}</div>
                  <div>{teacher.name}</div>
                  <div>{teacher.father_name}</div>
                  <div>{teacher.phone}</div>
                  <div>{teacher.email}</div>
                  <div>{teacher.department}</div>
                  <div>{teacher.salary}</div>
                  <div className="inline-actions">
                    <button className="button button-outline" type="button" onClick={() => onEditTeacher(teacher)}>
                      Edit
                    </button>
                    <button className="button button-outline" type="button" onClick={() => onDeleteTeacher(teacher)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {!loadingTeachers && teachers.length === 0 ? (
              <div className="muted-panel" style={{ marginTop: 12 }}>
                No teachers found.
              </div>
            ) : null}
            <PaginationControls
              count={teachersMeta.count}
              currentPage={teachersPage}
              pageSize={PAGE_SIZE}
              hasPrevious={Boolean(teachersMeta.previous)}
              hasNext={Boolean(teachersMeta.next)}
              onPrevious={() => loadTeachers(teacherSearch, Math.max(1, teachersPage - 1))}
              onNext={() => loadTeachers(teacherSearch, teachersPage + 1)}
            />
          </div>
        </>
      ) : null}

      {activeTab === "payments" ? (
        <>
          <div className="panel">
            <h3>1. Find Teacher</h3>
            <div className="inline-actions">
              <input
                className="input"
                value={paymentTeacherSearch}
                onChange={(event) => setPaymentTeacherSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchPaymentTeachers(1);
                  }
                }}
                placeholder="Search name, father, phone, email, department..."
              />
              <button
                className="button button-outline"
                type="button"
                onClick={() => searchPaymentTeachers(1)}
                disabled={searchingPaymentTeachers}
              >
                {searchingPaymentTeachers ? "Searching..." : "Search"}
              </button>
            </div>

            {selectedTeacher ? (
              <div className="muted-panel" style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong>Selected:</strong> {selectedTeacher.name} — {selectedTeacher.department}
                    <div style={{ marginTop: 4 }}>
                      Father: {selectedTeacher.father_name} · Phone: {selectedTeacher.phone} · Salary:{" "}
                      {selectedTeacher.salary}
                    </div>
                  </div>
                  <button className="button button-outline" type="button" onClick={clearSelectedTeacher}>
                    Change teacher
                  </button>
                </div>
              </div>
            ) : null}

            {!selectedTeacher ? (
              <>
                <div className="pill-list" style={{ marginTop: 12 }}>
                  {paymentTeachers.map((teacher) => (
                    <button
                      key={teacher.id}
                      className="pill"
                      type="button"
                      onClick={() => onSelectTeacherForPayment(teacher)}
                    >
                      {teacher.name} — {teacher.department} ({teacher.salary})
                    </button>
                  ))}
                </div>
                {searchingPaymentTeachers ? (
                  <div className="status-message" style={{ marginTop: 12 }}>
                    Searching teachers...
                  </div>
                ) : null}
                {!searchingPaymentTeachers && hasSearchedPaymentTeachers && paymentTeachers.length === 0 ? (
                  <div className="muted-panel" style={{ marginTop: 12 }}>
                    No teachers found. Try another search.
                  </div>
                ) : null}
                {!hasSearchedPaymentTeachers ? (
                  <div className="muted-panel" style={{ marginTop: 12 }}>
                    Search for a teacher, then click their name to select them.
                  </div>
                ) : null}
                {hasSearchedPaymentTeachers ? (
                  <PaginationControls
                    count={paymentTeachersMeta.count}
                    currentPage={paymentTeachersPage}
                    pageSize={PAGE_SIZE}
                    hasPrevious={Boolean(paymentTeachersMeta.previous)}
                    hasNext={Boolean(paymentTeachersMeta.next)}
                    onPrevious={() => searchPaymentTeachers(Math.max(1, paymentTeachersPage - 1))}
                    onNext={() => searchPaymentTeachers(paymentTeachersPage + 1)}
                  />
                ) : null}
              </>
            ) : null}
          </div>

          <div className="panel">
            <h3>2. Record Salary Payment</h3>
            {!selectedTeacher ? (
              <div className="muted-panel">Select a teacher above to record a payment.</div>
            ) : (
              <form className="form-grid" onSubmit={onSalaryPaymentSubmit}>
                <Field label="Teacher">
                  <input
                    className="input"
                    value={`${selectedTeacher.name} (${selectedTeacher.department})`}
                    readOnly
                  />
                </Field>
                <Field label="Date (Shamsi YYYY-MM-DD)">
                  <input
                    className="input"
                    value={salaryPaymentForm.date_shamsi}
                    onChange={onSalaryPaymentChange("date_shamsi")}
                    placeholder="1404-01-30"
                    required
                  />
                </Field>
                <Field label="Amount">
                  <input
                    className="input"
                    value={salaryPaymentForm.amount}
                    onChange={onSalaryPaymentChange("amount")}
                    placeholder={String(selectedTeacher.salary || "")}
                    required
                  />
                </Field>
                <Field label="Notes">
                  <input
                    className="input"
                    value={salaryPaymentForm.notes}
                    onChange={onSalaryPaymentChange("notes")}
                    placeholder="Optional notes"
                  />
                </Field>
                <button className="button button-primary" type="submit" disabled={savingSalaryPayment}>
                  {savingSalaryPayment ? "Saving..." : "Save Salary Payment"}
                </button>
              </form>
            )}
            {error ? <div className="form-error">{error}</div> : null}
            <p className="muted-panel" style={{ marginTop: 12 }}>
              Salary payments are only allowed up to Shamsi month 09.
            </p>
          </div>

          <div className="panel">
            <h3>3. Payment History</h3>
            {!selectedTeacher ? (
              <div className="muted-panel">Payment history appears after you select a teacher.</div>
            ) : (
              <>
                {loadingSalaryPayments ? <div className="status-message">Loading salary payments...</div> : null}
                <div className="table">
                  <div className="table-head">
                    <div>ID</div>
                    <div>Date</div>
                    <div>Amount</div>
                    <div>Notes</div>
                  </div>
                  {salaryPayments.map((payment) => (
                    <div className="table-row" key={payment.id}>
                      <div>{payment.id}</div>
                      <div>{payment.date_shamsi}</div>
                      <div>{payment.amount}</div>
                      <div>{payment.notes || "—"}</div>
                    </div>
                  ))}
                </div>
                {!loadingSalaryPayments && salaryPayments.length === 0 ? (
                  <div className="muted-panel" style={{ marginTop: 12 }}>
                    No salary payments found for this teacher.
                  </div>
                ) : null}
                <PaginationControls
                  count={salaryPaymentsMeta.count}
                  currentPage={salaryPaymentsPage}
                  pageSize={PAGE_SIZE}
                  hasPrevious={Boolean(salaryPaymentsMeta.previous)}
                  hasNext={Boolean(salaryPaymentsMeta.next)}
                  onPrevious={() => loadSalaryPayments(selectedTeacher.id, Math.max(1, salaryPaymentsPage - 1))}
                  onNext={() => loadSalaryPayments(selectedTeacher.id, salaryPaymentsPage + 1)}
                />
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
