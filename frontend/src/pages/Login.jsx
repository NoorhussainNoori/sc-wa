import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api.js";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-mark">WH</div>
          <div>
            <div className="auth-title">Watan High School</div>
            <div className="auth-subtitle">Finance Admin Login</div>
          </div>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span className="field-label">Username</span>
            <input
              className="input"
              value={form.username}
              onChange={onChange("username")}
              placeholder="admin"
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={onChange("password")}
              placeholder="••••••••"
              required
            />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <button className="button button-primary" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
      <div className="auth-panel">
        <h1>School Finance, clearly managed.</h1>
        <p>
          Track student fees, teacher salaries, and expenses. Generate reports by
          day, month, year, or custom date ranges.
        </p>
      </div>
    </div>
  );
}
