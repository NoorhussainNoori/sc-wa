const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0"));
const YEARS = Array.from({ length: 30 }, (_, index) => String(1398 + index));

export default function ShamsiDatePicker({ value, onChange, className = "input", placeholder = "Select date" }) {
  const [year, month, day] = String(value || "").split("-");

  const update = (nextYear = year, nextMonth = month, nextDay = day) => {
    const y = String(nextYear || "").trim();
    const m = String(nextMonth || "").trim();
    const d = String(nextDay || "").trim() || "01";
    if (y && m) {
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange("");
    }
  };

  return (
    <div className="shamsi-date-picker" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 8 }}>
        <select className={className} value={year || ""} onChange={(event) => update(event.target.value, month, day)}>
          <option value="">{placeholder}</option>
          {YEARS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select className={className} value={month || ""} onChange={(event) => update(year, event.target.value, day)}>
          <option value="">Month</option>
          {MONTHS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select className={className} value={day || ""} onChange={(event) => update(year, month, event.target.value)}>
          <option value="">Day (defaults to 01)</option>
          {DAYS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <input className={className} value={value || ""} readOnly placeholder="YYYY-MM-DD" />
    </div>
  );
}
