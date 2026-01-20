import { useMemo } from "react";
import { useParams, Navigate } from "react-router-dom";
import CmsShell from "./CmsShell";

const ALLOWED_KEYS = new Set([
  "c5fe8f3d5aa14af2b7ddfbd22cc72d94",
  "d7c88020e1ea95dd060d90414b4da77e",
  "07112370d92c4301262c47d0d9f4096d",
  "f63b4c0e48b3abfc4e898de035655bab",
  "e1d7a392d68e2e8290ac3cd06a0884aa",
  "42ddc20c92e70d4398b55e30fe1c765e",
  "b0440e852e0e5455b1917bfcaedf31cf",
  "d207f151bdfdb299700ee3b201b71f1e",
  "387d06eb745fbf1c88d5533dc4aad2f5",
  "aa835a34b64a318f39ce9e34ee374c3b",
]);

export default function CmsGate() {
  const { cmsKey } = useParams();

  const ok = useMemo(() => {
    if (!cmsKey) return false;
    return ALLOWED_KEYS.has(String(cmsKey).trim());
  }, [cmsKey]);

  if (!ok) return <Navigate to="/" replace />;

  return <CmsShell cmsKey={cmsKey} />;
}
