import { Navigate } from "react-router-dom";
import CmsShell from "./CmsShell";

export default function CmsGate() {
  const token = localStorage.getItem("hay_cms_token") || "";

  // No CMS token => go to CMS login (not main app landing)
  if (!token) return <Navigate to="/cms/login" replace />;

  return <CmsShell />;
}
