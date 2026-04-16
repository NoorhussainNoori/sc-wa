const API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";

export function getToken() {
  return localStorage.getItem("auth_token");
}

export function setToken(token) {
  localStorage.setItem("auth_token", token);
}

export function clearToken() {
  localStorage.removeItem("auth_token");
}

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    let detail = "Login failed";
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      detail = res.statusText || detail;
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  if (data?.token) {
    setToken(data.token);
  }
  return data;
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let detail = "Request failed";
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      detail = res.statusText || detail;
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) {
    return null;
  }
  return res.json();
}

/** Download backup JSON (Django dumpdata). Uses blob + Content-Disposition filename. */
export async function downloadBackup() {
  const token = getToken();
  const res = await fetch(`${API_BASE}/backup/export/`, {
    headers: token ? { Authorization: `Token ${token}` } : {},
  });
  if (!res.ok) {
    let detail = "Download failed";
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      detail = res.statusText || detail;
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  let filename = "school_rasool_backup.json";
  const cd = res.headers.get("Content-Disposition");
  if (cd) {
    const m = /filename="([^"]+)"/.exec(cd) || /filename=([^;]+)/.exec(cd);
    if (m) filename = m[1].trim();
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Restore from backup file. Replaces all data (server flush + loaddata). */
export async function restoreBackup(file) {
  const token = getToken();
  const fd = new FormData();
  fd.append("confirm", "RESTORE");
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/backup/restore/`, {
    method: "POST",
    headers: token ? { Authorization: `Token ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    let detail = "Restore failed";
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      detail = res.statusText || detail;
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function extractListData(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.results)) {
    return payload.results;
  }
  return [];
}

export function extractPaginationMeta(payload) {
  if (payload && !Array.isArray(payload) && Array.isArray(payload.results)) {
    return {
      count: payload.count ?? payload.results.length,
      next: payload.next ?? null,
      previous: payload.previous ?? null,
    };
  }
  return {
    count: Array.isArray(payload) ? payload.length : 0,
    next: null,
    previous: null,
  };
}
