import { Link, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import AgaveMark from "./components/AgaveMark";
import ThemeToggle from "./components/ThemeToggle";
import Home from "./pages/Home";
import ItemPage from "./pages/ItemPage";
import About from "./pages/About";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminManage from "./pages/admin/AdminManage";
import AdminEdit from "./pages/admin/AdminEdit";

function Header() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  return (
    <header className="ff-header">
      <Link to="/" className="ff-logo" aria-label="Frontera Finds — home">
        <AgaveMark size={34} outer="#8FE6A3" inner="#5BD074" core="#E2A33C" />
        <span className="ff-wordmark">
          <span className="ff-wordmark-main">FRONTERA</span>
          <span className="ff-wordmark-sub">FINDS</span>
        </span>
      </Link>
      <form
        className="ff-search"
        onSubmit={(e) => { e.preventDefault(); navigate(`/?q=${encodeURIComponent(q)}`); }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar / Search items…" />
      </form>
      <ThemeToggle />
      <Link to="/admin" className="ff-sell">Sell</Link>
    </header>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/item/:id" element={<ItemPage />} />
        <Route path="/about" element={<About />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/manage" element={<AdminManage />} />
        <Route path="/admin/new" element={<AdminEdit />} />
        <Route path="/admin/edit/:id" element={<AdminEdit />} />
      </Routes>
      <footer className="ff-footer">
        <AgaveMark size={50} outer="#5BD074" inner="#8FE6A3" core="#E2A33C" />
        <span className="ff-wordmark" style={{ alignItems: "center" }}>
          <span className="ff-wordmark-main" style={{ fontSize: 24 }}>FRONTERA</span>
          <span className="ff-wordmark-sub" style={{ fontSize: 14 }}>FINDS</span>
        </span>
        <p className="ff-footer-tag">El swapmeet sin fronteras — two cities, one marketplace.</p>
        <p className="ff-footer-meta">
          Shipping across the USA · Local pickup &amp; delivery in San Diego ⟷ Tijuana ·{" "}
          <Link to="/about">How it works</Link>
        </p>
      </footer>
    </>
  );
}
