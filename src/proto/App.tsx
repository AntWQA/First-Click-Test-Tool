import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { HomePage, NON_PAGE_REDIRECTS, StubPage } from "./pages/StubPage";
import { ResultsPage } from "./search/components/ResultsPage";
import { SearchProvider } from "./search/SearchProvider";

/** Route changes start at the top of the page; query-string-only changes (filters, pagination) keep their position. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <SearchProvider>
      <ScrollToTop />
      <SiteHeader />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<ResultsPage />} />
        {/* Shop is the All Products page: the results view with no query */}
        <Route path="/shop" element={<ResultsPage />} />
        {Object.entries(NON_PAGE_REDIRECTS).map(([from, to]) => <Route key={from} path={from} element={<Navigate to={to} replace />} />)}
        <Route path="*" element={<StubPage />} />
      </Routes>
      <SiteFooter />
    </SearchProvider>
  );
}
