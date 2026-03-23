export default function Field({
  label,
  children,
  helper,
  error,
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {helper ? <span className="field-helper">{helper}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}
