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
  const [form, setForm] = useState(emptyTeacher);
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [error, setError] = useState("");
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
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

  const loadTeachers = async (page = 1) => {
    setLoadingTeachers(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
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
    void loadTeachers(1);
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
      await loadTeachers(teachersPage);
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
        setSelectedTeacher(null);
        setSalaryPayments([]);
        setSalaryPaymentForm(emptySalaryPayment);
      }
      await loadTeachers(teachersPage);
    } catch (err) {
      setError(err.message || "Failed to delete teacher.");
    }
  };

  const onSelectTeacher = (teacher) => {
    setSelectedTeacher(teacher);
    setSalaryPaymentForm({
      date_shamsi: "",
      amount: teacher.salary || "",
      notes: "",
    });
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
      await loadSalaryPayments(selectedTeacher.id, salaryPaymentsPage);
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
              ? "Register teachers and set their salary."
              : "Record monthly teacher salary payments."}
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
          onClick={() => setActiveTab("payments")}
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
            {loadingTeachers ? <div className="status-message">Loading teachers...</div> : null}
            {error ? <div className="form-error">{error}</div> : null}
          </div>

          <div className="panel">
            <h3>Teacher List</h3>
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
                No data found.
              </div>
            ) : null}
            <PaginationControls
              count={teachersMeta.count}
              currentPage={teachersPage}
              pageSize={PAGE_SIZE}
              hasPrevious={Boolean(teachersMeta.previous)}
              hasNext={Boolean(teachersMeta.next)}
              onPrevious={() => loadTeachers(Math.max(1, teachersPage - 1))}
              onNext={() => loadTeachers(teachersPage + 1)}
            />
          </div>
        </>
      ) : null}

      {activeTab === "payments" ? (
        <div className="panel">
          <h3>Salary Payments</h3>
          <p className="muted-panel" style={{ marginBottom: 12 }}>
            Select a teacher, then record monthly salary payments against the teacher salary you set above. Salary
            payments stop at Shamsi month 09.
          </p>
          <div className="pill-list" style={{ marginBottom: 12 }}>
            {teachers.map((teacher) => (
              <button
                key={`teacher-select-${teacher.id}`}
                className={`pill ${selectedTeacher?.id === teacher.id ? "pill-active" : ""}`}
                type="button"
                onClick={() => onSelectTeacher(teacher)}
              >
                {teacher.name} - {teacher.department}
              </button>
            ))}
          </div>
          <form className="form-grid" onSubmit={onSalaryPaymentSubmit}>
            <Field label="Selected Teacher">
              <input
                className="input"
                value={selectedTeacher ? `${selectedTeacher.name} (${selectedTeacher.department})` : ""}
                readOnly
                placeholder="Select a teacher above"
              />
            </Field>
            <Field label="Date (Shamsi YYYY-MM-DD)">
              <input
                className="input"
                value={salaryPaymentForm.date_shamsi}
                onChange={onSalaryPaymentChange("date_shamsi")}
                placeholder="1404-01-30"
              />
            </Field>
            <Field label="Amount">
              <input
                className="input"
                value={salaryPaymentForm.amount}
                onChange={onSalaryPaymentChange("amount")}
                placeholder={selectedTeacher?.salary || "Teacher salary"}
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
          {loadingSalaryPayments ? <div className="status-message">Loading salary payments...</div> : null}
          {error ? <div className="form-error">{error}</div> : null}
          <div className="table" style={{ marginTop: 12 }}>
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
          {!loadingSalaryPayments && selectedTeacher && salaryPayments.length === 0 ? (
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
            onPrevious={() =>
              selectedTeacher ? loadSalaryPayments(selectedTeacher.id, Math.max(1, salaryPaymentsPage - 1)) : null
            }
            onNext={() => (selectedTeacher ? loadSalaryPayments(selectedTeacher.id, salaryPaymentsPage + 1) : null)}
          />
        </div>
      ) : null}
    </div>
  );
}
