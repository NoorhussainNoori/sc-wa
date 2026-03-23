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

export default function Teachers() {
  const PAGE_SIZE = 10;
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

  useEffect(() => {
    const run = async () => {
      await loadTeachers(1);
    };
    void run();
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
      await loadTeachers();
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
      await loadTeachers(teachersPage);
    } catch (err) {
      setError(err.message || "Failed to delete teacher.");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Teachers</h2>
          <p>Register teachers and track salaries.</p>
        </div>
      </div>

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
    </div>
  );
}
