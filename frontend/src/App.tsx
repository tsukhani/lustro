import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import Dashboard from "@/pages/Dashboard";
import Scan from "@/pages/Scan";
import Results from "@/pages/Results";
import Settings from "@/pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/scan/:type" element={<Scan />} />
              <Route path="/results/:scanId" element={<Results />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
      <Toaster />
    </BrowserRouter>
  );
}
