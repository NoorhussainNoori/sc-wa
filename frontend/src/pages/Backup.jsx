import { useState } from "react";
import { clearToken, downloadBackup, restoreBackup } from "../api.js";
import Field from "../components/Field.jsx";

export default function Backup() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [file, setFile] = useState(null);
  const [ackRestore, setAckRestore] = useState(false);

  const onDownload = async () => {
    setError("");
    setSuccess("");
    setDownloading(true);
    try {
      await downloadBackup();
      setSuccess("Backup file downloaded. Store it somewhere safe.");
    } catch (err) {
      setError(err.message || "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const onRestore = async () => {
    setError("");
    setSuccess("");
    if (!file) {
      setError("Choose a backup .json file first.");
      return;
    }
    if (!ackRestore) {
      setError("Confirm that you understand this will replace all current data.");
      return;
    }
    setRestoring(true);
    try {
      const data = await restoreBackup(file);
      setSuccess(data?.detail || "Restore completed.");
      clearToken();
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch (err) {
      setError(err.message || "Restore failed.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Backup &amp; restore</h2>
          <p>Download a full copy of your data, or restore from a file you saved earlier.</p>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="status-message">{success}</div> : null}

      <div className="panel">
        <h3>Download backup</h3>
        <p className="muted-panel">
          Includes users, API tokens, and all school records (same as{" "}
          <code>python manage.py export_backup</code>). Keep the file private.
        </p>
        <button
          type="button"
          className="button button-primary"
          onClick={() => void onDownload()}
          disabled={downloading}
        >
          {downloading ? "Preparing…" : "Download backup (.json)"}
        </button>
      </div>

      <div className="panel">
        <h3>Restore from backup</h3>
        <p className="muted-panel">
          The server clears the database, then loads your file. If loading fails after the clear, you
          must restore again from a good backup. Backups from an older app version may not load after
          model changes.
        </p>
        <div className="form-grid">
          <Field label="Backup file">
            <input
              type="file"
              accept=".json,application/json"
              className="input"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Field>
        </div>
        <label className="checkbox-field" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={ackRestore}
            onChange={(e) => setAckRestore(e.target.checked)}
          />
          <span>I understand this will erase current data and replace it with the backup.</span>
        </label>
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            className="button button-danger"
            onClick={() => void onRestore()}
            disabled={restoring}
          >
            {restoring ? "Restoring…" : "Restore from file"}
          </button>
        </div>
      </div>
    </div>
  );
}
