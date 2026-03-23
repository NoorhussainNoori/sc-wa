export default function Topbar({ onLogout }) {
  return (
    <header className="topbar">
      <div>
        <div className="topbar-title">School Finance</div>
        <div className="topbar-subtitle">Fast records. Clear reports.</div>
      </div>
      <button className="button button-outline" onClick={onLogout}>
        Log out
      </button>
    </header>
  );
}
