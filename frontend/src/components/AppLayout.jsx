import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import { clearToken } from "../api.js";

export default function AppLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar onLogout={handleLogout} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
