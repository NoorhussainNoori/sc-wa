import { useEffect, useState } from "react";
import { apiFetch, extractListData, extractPaginationMeta } from "../api.js";
import Field from "../components/Field.jsx";
import PaginationControls from "../components/PaginationControls.jsx";

const emptyStudent = {
  school_class: "",
  name: "",
  registration_number: "",
  father_name: "",
  grandfather_name: "",
  phone: "",
  monthly_fee_override: "",
  transport_fee_override: "",
  uniform_fee_override: "",
  book_fee_override: "",
  previous_balance: "",
};

export default function Students() {
  const PAGE_SIZE = 10;
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsMeta, setStudentsMeta] = useState({
    count: 0,
    next: null,
    previous: null,
  });
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyStudent);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [error, setError] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingStudent, setSavingStudent] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importMode, setImportMode] = useState("partial");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const loadStudents = async (query = "", page = 1) => {
    setLoadingStudents(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      const data = await apiFetch(`/students/?${params.toString()}`);
      setStudents(extractListData(data));
      setStudentsMeta(extractPaginationMeta(data));
      setStudentsPage(page);
    } catch (err) {
      setError(err.message || "Failed to load students.");
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadClasses = async () => {
    try {
      const data = await apiFetch("/classes/?page_size=100");
      setClasses(extractListData(data));
    } catch (err) {
      setError(err.message || "Failed to load classes.");
    }
  };

  useEffect(() => {
    const run = async () => {
      await Promise.all([loadStudents(), loadClasses()]);
    };
    void run();
  }, []);

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSavingStudent(true);
    try {
      await apiFetch(editingStudentId ? `/students/${editingStudentId}/` : "/students/", {
        method: editingStudentId ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          school_class: form.school_class || null,
          previous_balance: form.previous_balance || "0",
        }),
      });
      setForm(emptyStudent);
      setEditingStudentId(null);
      await loadStudents(search, studentsPage);
    } catch (err) {
      setError(err.message || `Failed to ${editingStudentId ? "update" : "create"} student.`);
    } finally {
      setSavingStudent(false);
    }
  };

  const onEditStudent = (student) => {
    setEditingStudentId(student.id);
    setForm({
      school_class: student.school_class || "",
      name: student.name || "",
      registration_number: student.registration_number || "",
      father_name: student.father_name || "",
      grandfather_name: student.grandfather_name || "",
      phone: student.phone || "",
      monthly_fee_override: student.monthly_fee_override || "",
      transport_fee_override: student.transport_fee_override || "",
      uniform_fee_override: student.uniform_fee_override || "",
      book_fee_override: student.book_fee_override || "",
      previous_balance: student.previous_balance || "",
    });
  };

  const onDeleteStudent = async (student) => {
    if (!window.confirm(`Delete student "${student.name}"?`)) return;
    setError("");
    try {
      await apiFetch(`/students/${student.id}/`, { method: "DELETE" });
      if (editingStudentId === student.id) {
        setEditingStudentId(null);
        setForm(emptyStudent);
      }
      await loadStudents(search, studentsPage);
    } catch (err) {
      setError(err.message || "Failed to delete student.");
    }
  };

  const downloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api"}/students/import-template/`, {
        headers: { Authorization: `Token ${localStorage.getItem("auth_token") || ""}` },
      });
      if (!res.ok) {
        throw new Error("Failed to download template.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "students_import_template.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Failed to download template.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const onImportStudents = async (event) => {
    event.preventDefault();
    if (!importFile) {
      setError("Choose a CSV or XLSX file first.");
      return;
    }
    setError("");
    setImporting(true);
    setImportResult(null);
    try {
      const payload = new FormData();
      payload.append("file", importFile);
      payload.append("mode", importMode);
      const result = await apiFetch("/students/import/", {
        method: "POST",
        body: payload,
      });
      setImportResult(result);
      await loadStudents(search, 1);
      setImportFile(null);
    } catch (err) {
      setError(err.message || "Failed to import students.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Students</h2>
          <p>Register students and manage fee profiles.</p>
        </div>
        <div className="inline-actions">
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, registration number, father, grandfather, phone..."
          />
          <button className="button button-outline" onClick={() => loadStudents(search, 1)} disabled={loadingStudents}>
            {loadingStudents ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>Bulk Import Students (CSV/XLSX)</h3>
        <form className="form-grid" onSubmit={onImportStudents}>
          <Field label="File">
            <input
              className="input"
              type="file"
              accept=".csv,.xlsx"
              onChange={(event) => setImportFile(event.target.files?.[0] || null)}
              required
            />
          </Field>
          <Field label="Mode">
            <select className="input" value={importMode} onChange={(event) => setImportMode(event.target.value)}>
              <option value="partial">Partial (import valid rows)</option>
              <option value="strict">Strict (all rows must be valid)</option>
            </select>
          </Field>
          <div className="inline-actions">
            <button className="button button-primary" type="submit" disabled={importing}>
              {importing ? "Importing..." : "Import Students"}
            </button>
            <button className="button button-outline" type="button" onClick={downloadTemplate} disabled={downloadingTemplate}>
              {downloadingTemplate ? "Preparing..." : "Download Template"}
            </button>
          </div>
        </form>
        {importResult ? (
          <div className="import-summary">
            <div>Total Rows: {importResult.total_rows}</div>
            <div>Imported: {importResult.imported}</div>
            <div>Failed: {importResult.failed}</div>
            {Array.isArray(importResult.errors) && importResult.errors.length ? (
              <div className="import-errors">
                {importResult.errors.slice(0, 20).map((item, idx) => (
                  <div key={`${item.row}-${item.field}-${idx}`}>
                    Row {item.row} - {item.field}: {item.message}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="panel">
        <h3>{editingStudentId ? "Edit Student" : "New Student"}</h3>
        <form className="student-form" onSubmit={onSubmit}>
          <div className="student-form-main">
            <div className="form-grid">
              <Field label="Class">
                <select className="input" value={form.school_class} onChange={onChange("school_class")}>
                  <option value="">Select class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.year_shamsi})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Name">
                <input className="input" value={form.name} onChange={onChange("name")} required />
              </Field>
              <Field label="Registration Number">
                <input
                  className="input"
                  value={form.registration_number}
                  onChange={onChange("registration_number")}
                  required
                />
              </Field>
              <Field label="Father Name">
                <input className="input" value={form.father_name} onChange={onChange("father_name")} required />
              </Field>
              <Field label="Grandfather Name">
                <input className="input" value={form.grandfather_name} onChange={onChange("grandfather_name")} required />
              </Field>
              <Field label="Phone">
                <input className="input" value={form.phone} onChange={onChange("phone")} required />
              </Field>
            </div>
            <button className="button button-primary button-wide" type="submit" disabled={savingStudent}>
              {savingStudent ? "Saving..." : editingStudentId ? "Update Student" : "Save Student"}
            </button>
            {editingStudentId ? (
              <button
                className="button button-outline"
                type="button"
                onClick={() => {
                  setEditingStudentId(null);
                  setForm(emptyStudent);
                }}
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
          <div className="student-form-side">
            {form.school_class ? (
              <div className="side-panel">
                <h4>Class Fees (Editable per student)</h4>
                {(() => {
                  const classEntry = classes.find(
                    (cls) => String(cls.id) === String(form.school_class)
                  );
                  if (!classEntry) return <div>—</div>;
                  return (
                    <>
                      <div className="stats-compact">
                        <div className="stat-card">
                          <div className="stat-label">Monthly (Class)</div>
                          <div className="stat-value">{classEntry.monthly_fee}</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-label">Transport (Class)</div>
                          <div className="stat-value">{classEntry.transport_fee}</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-label">Uniform (Class)</div>
                          <div className="stat-value">{classEntry.uniform_fee}</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-label">Book (Class)</div>
                          <div className="stat-value">{classEntry.book_fee}</div>
                        </div>
                      </div>
                      <div className="form-grid compact-grid">
                        <Field label="Monthly Fee Override">
                          <input
                            className="input"
                            value={form.monthly_fee_override}
                            onChange={onChange("monthly_fee_override")}
                            placeholder="Leave blank to use class fee"
                          />
                        </Field>
                        <Field label="Transport Fee Override">
                          <input
                            className="input"
                            value={form.transport_fee_override}
                            onChange={onChange("transport_fee_override")}
                            placeholder="Leave blank to use class fee"
                          />
                        </Field>
                        <Field label="Uniform Fee Override">
                          <input
                            className="input"
                            value={form.uniform_fee_override}
                            onChange={onChange("uniform_fee_override")}
                            placeholder="Leave blank to use class fee"
                          />
                        </Field>
                        <Field label="Book Fee Override">
                          <input
                            className="input"
                            value={form.book_fee_override}
                            onChange={onChange("book_fee_override")}
                            placeholder="Leave blank to use class fee"
                          />
                        </Field>
                        <Field label="Previous Year Balance">
                          <input
                            className="input"
                            value={form.previous_balance}
                            onChange={onChange("previous_balance")}
                            placeholder="Old unpaid balance"
                          />
                        </Field>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="side-panel muted-panel">
                Select a class to view and override fees.
              </div>
            )}
          </div>
        </form>
        {loadingStudents ? <div className="status-message">Loading students...</div> : null}
        {error ? <div className="form-error">{error}</div> : null}
      </div>

      <div className="panel">
        <h3>Student List</h3>
        <div className="table">
          <div className="table-head">
            <div>ID</div>
            <div>Name</div>
            <div>Reg No</div>
            <div>Father</div>
            <div>Grandfather</div>
            <div>Phone</div>
            <div>Class</div>
            <div>Previous Balance</div>
            <div>Actions</div>
          </div>
          {students.map((student) => {
            const classEntry = classes.find((cls) => cls.id === student.school_class);
            return (
              <div className="table-row" key={student.id}>
                <div>{student.id}</div>
                <div>{student.name}</div>
                <div>{student.registration_number || "—"}</div>
                <div>{student.father_name}</div>
                <div>{student.grandfather_name}</div>
                <div>{student.phone}</div>
                <div>
                  {classEntry ? `${classEntry.name} (${classEntry.year_shamsi})` : "—"}
                </div>
                <div>{student.previous_balance || "0.00"}</div>
                <div className="inline-actions">
                  <button className="button button-outline" type="button" onClick={() => onEditStudent(student)}>
                    Edit
                  </button>
                  <button className="button button-outline" type="button" onClick={() => onDeleteStudent(student)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {!loadingStudents && students.length === 0 ? (
          <div className="muted-panel" style={{ marginTop: 12 }}>
            No data found.
          </div>
        ) : null}
        <PaginationControls
          count={studentsMeta.count}
          currentPage={studentsPage}
          pageSize={PAGE_SIZE}
          hasPrevious={Boolean(studentsMeta.previous)}
          hasNext={Boolean(studentsMeta.next)}
          onPrevious={() => loadStudents(search, Math.max(1, studentsPage - 1))}
          onNext={() => loadStudents(search, studentsPage + 1)}
        />
      </div>
    </div>
  );
}
