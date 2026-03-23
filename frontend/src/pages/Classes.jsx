import { useEffect, useState } from "react";
import { apiFetch, extractListData, extractPaginationMeta } from "../api.js";
import Field from "../components/Field.jsx";
import PaginationControls from "../components/PaginationControls.jsx";

const emptyClass = {
  name: "",
  year_shamsi: "",
  monthly_fee: "",
  transport_fee: "",
  uniform_fee: "",
  book_fee: "",
};

export default function Classes() {
  const PAGE_SIZE = 10;
  const [classes, setClasses] = useState([]);
  const [classesPage, setClassesPage] = useState(1);
  const [classesMeta, setClassesMeta] = useState({
    count: 0,
    next: null,
    previous: null,
  });
  const [form, setForm] = useState(emptyClass);
  const [error, setError] = useState("");

  const loadClasses = async (page = 1) => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      const data = await apiFetch(`/classes/?${params.toString()}`);
      setClasses(extractListData(data));
      setClassesMeta(extractPaginationMeta(data));
      setClassesPage(page);
    } catch (err) {
      setError(err.message || "Failed to load classes.");
    }
  };

  useEffect(() => {
    const run = async () => {
      await loadClasses(classesPage);
    };
    void run();
  }, []);

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/classes/", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(emptyClass);
      await loadClasses();
    } catch (err) {
      setError(err.message || "Failed to create class.");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Classes</h2>
          <p>Create classes per year and define fee settings.</p>
        </div>
      </div>

      <div className="panel">
        <h3>New Class</h3>
        <form className="form-grid" onSubmit={onSubmit}>
          <Field label="Class Name">
            <input className="input" value={form.name} onChange={onChange("name")} required />
          </Field>
          <Field label="Shamsi Year (YYYY)">
            <input className="input" value={form.year_shamsi} onChange={onChange("year_shamsi")} required />
          </Field>
          <Field label="Monthly Fee">
            <input className="input" value={form.monthly_fee} onChange={onChange("monthly_fee")} required />
          </Field>
          <Field label="Transport Fee">
            <input className="input" value={form.transport_fee} onChange={onChange("transport_fee")} required />
          </Field>
          <Field label="Uniform Fee">
            <input className="input" value={form.uniform_fee} onChange={onChange("uniform_fee")} required />
          </Field>
          <Field label="Book Fee">
            <input className="input" value={form.book_fee} onChange={onChange("book_fee")} required />
          </Field>
          <button className="button button-primary" type="submit">
            Save Class
          </button>
        </form>
        {error ? <div className="form-error">{error}</div> : null}
      </div>

      <div className="panel">
        <h3>Class List</h3>
        <div className="table">
          <div className="table-head">
            <div>ID</div>
            <div>Name</div>
            <div>Year</div>
            <div>Monthly</div>
            <div>Transport</div>
            <div>Uniform</div>
            <div>Book</div>
          </div>
          {classes.map((cls) => (
            <div className="table-row" key={cls.id}>
              <div>{cls.id}</div>
              <div>{cls.name}</div>
              <div>{cls.year_shamsi}</div>
              <div>{cls.monthly_fee}</div>
              <div>{cls.transport_fee}</div>
              <div>{cls.uniform_fee}</div>
              <div>{cls.book_fee}</div>
            </div>
          ))}
        </div>
        <PaginationControls
          count={classesMeta.count}
          currentPage={classesPage}
          pageSize={PAGE_SIZE}
          hasPrevious={Boolean(classesMeta.previous)}
          hasNext={Boolean(classesMeta.next)}
          onPrevious={() => loadClasses(Math.max(1, classesPage - 1))}
          onNext={() => loadClasses(classesPage + 1)}
        />
      </div>
    </div>
  );
}
