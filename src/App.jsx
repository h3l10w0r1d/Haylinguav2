import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./Landing";
import Login from "./Login";
import Signup from "./Signup";
import Dashboard from "./Dashboard"; // ⬅️ NEW

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} /> {/* ⬅️ NEW */}
      </Routes>
    </BrowserRouter>
  );
}
