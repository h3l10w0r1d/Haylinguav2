// src/cms/CmsRequireAuth.jsx — one auth gate for every /cms/* route.
//
// Previously only the /cms index went through CmsGate; each other page
// self-checked for a token after its hooks ran. This layout route wraps them
// all in App.jsx: no CMS token → /cms/login (remembering where the visitor
// was headed, so login can send them back), otherwise render the child route.
//
// It also registers the api.js 401 handler: an expired/revoked token now
// clears itself and returns to login instead of leaving a page showing
// "Request failed (401)".
import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getCmsToken, setCmsUnauthorizedHandler } from "./api";
import { ConfirmProvider } from "./ui/ConfirmDialog";

export default function CmsRequireAuth() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = getCmsToken();

  useEffect(() => {
    setCmsUnauthorizedHandler(() => {
      try { localStorage.removeItem("hay_cms_token"); } catch {}
      navigate("/cms/login", { replace: true, state: { from: location.pathname + location.search } });
    });
    return () => setCmsUnauthorizedHandler(null);
  }, [navigate, location.pathname, location.search]);

  if (!token) {
    return <Navigate to="/cms/login" replace state={{ from: location.pathname + location.search }} />;
  }
  // Pages call useConfirm() in their own body, above the <CmsLayout> they
  // render, so the provider has to sit here too; CmsLayout's inner one
  // still serves components rendered inside the layout.
  return (
    <ConfirmProvider>
      <Outlet />
    </ConfirmProvider>
  );
}
