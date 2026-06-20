import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { adminApi, getToken, setToken } from "../../lib/api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (getToken()) return <Navigate to="/admin/manage" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await adminApi.login(password);
      setToken(token);
      navigate("/admin/manage");
    } catch {
      setError("Wrong password.");
    }
  }

  return (
    <main className="ff-wrap" style={{ maxWidth: 360 }}>
      <h1>Seller login</h1>
      <form onSubmit={submit}>
        <div className="ff-field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        {error && <p style={{ color: "#a50e0e" }}>{error}</p>}
        <button className="ff-btn ff-btn-green" type="submit">Log in</button>
      </form>
    </main>
  );
}
