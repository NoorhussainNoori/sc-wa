import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page">
      <div className="panel">
        <h2>Page Not Found</h2>
        <p>The page you requested does not exist.</p>
        <Link className="button button-outline" to="/">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
