import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import Dashboard from "@/pages/Dashboard";
import Scan from "@/pages/Scan";
import Results from "@/pages/Results";
import Settings from "@/pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={300}>
        <div className="flex min-h-screen bg-background text-foreground">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <Header />
            <main className="flex-1 p-4 md:p-6 overflow-auto">
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
      </TooltipProvider>
    </BrowserRouter>
  );
}
