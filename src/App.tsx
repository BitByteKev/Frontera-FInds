import { Link, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import AgaveMark from "./components/AgaveMark";
import ThemeToggle from "./components/ThemeToggle";
import LanguageToggle from "./components/LanguageToggle";
import { useLang } from "./i18n/LanguageContext";
import Home from "./pages/Home";
import ItemPage from "./pages/ItemPage";
import About from "./pages/About";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminManage from "./pages/admin/AdminManage";
import AdminEdit from "./pages/admin/AdminEdit";
import AdminDashboard from "./pages/admin/AdminDashboard";

function Header() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  return (
    <header className="ff-header">
      <Link to="/" className="ff-logo" aria-label={t("nav.logoAria")}>
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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("header.searchPlaceholder")} />
      </form>
      <LanguageToggle />
      <ThemeToggle />
      <Link to="/admin" className="ff-sell">{t("header.sell")}</Link>
    </header>
  );
}

export default function App() {
  const { t } = useLang();
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/item/:id" element={<ItemPage />} />
        <Route path="/about" element={<About />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/manage" element={<AdminManage />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/new" element={<AdminEdit />} />
        <Route path="/admin/edit/:id" element={<AdminEdit />} />
      </Routes>
      <footer className="ff-footer">
        <AgaveMark size={50} outer="#5BD074" inner="#8FE6A3" core="#E2A33C" />
        <span className="ff-wordmark" style={{ alignItems: "center" }}>
          <span className="ff-wordmark-main" style={{ fontSize: 24 }}>FRONTERA</span>
          <span className="ff-wordmark-sub" style={{ fontSize: 14 }}>FINDS</span>
        </span>
        <p className="ff-footer-tag">{t("footer.tag")}</p>
        <p className="ff-footer-meta">
          {t("footer.meta")}
          <Link to="/about">{t("footer.howItWorks")}</Link>
        </p>
        <div style={{ display: "flex", gap: 16 }}>
          <a
            className="ff-social"
            href="https://instagram.com/fronterafind.s"
            target="_blank"
            rel="noreferrer"
            aria-label={t("footer.instagramAria")}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="17.4" cy="6.6" r="1.25" fill="currentColor" />
            </svg>
          </a>
          <a
            className="ff-social"
            href="https://www.facebook.com/marketplace/profile/61558944447221/"
            target="_blank"
            rel="noreferrer"
            aria-label={t("footer.facebookAria")}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M15.6 8.3h-1.4c-.6 0-1 .4-1 1v1.5h2.3l-.35 2.2h-1.95v6h-2.3v-6H9.3v-2.2h1.6V9.2c0-1.9 1.1-3 3-3h1.7v2.1z"
                fill="currentColor"
              />
            </svg>
          </a>
        </div>
      </footer>
    </>
  );
}
