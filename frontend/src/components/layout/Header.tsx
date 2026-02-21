import { useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { MobileSidebar } from "./Sidebar";
import { Progress } from "@/components/ui/progress";
import { useStorage } from "@/hooks/useStorage";
import { formatBytes } from "@/lib/utils";
import { SCAN_TYPE_LABELS } from "@/lib/utils";
import type { ScanType } from "@/types";
import { HardDrive } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function usePageTitle(): string {
  const location = useLocation();
  const path = location.pathname;

  if (path === "/") return "Dashboard";
  if (path === "/settings") return "Settings";

  const scanMatch = path.match(/^\/scan\/(.+)$/);
  if (scanMatch) {
    const scanType = scanMatch[1] as ScanType;
    return SCAN_TYPE_LABELS[scanType] ?? scanType;
  }

  const resultsMatch = path.match(/^\/results\/(.+)$/);
  if (resultsMatch) return "Scan Results";

  return "Lustro";
}

function StorageSummary() {
  const { stats, loading } = useStorage();

  if (loading || stats.length === 0) return null;

  // All folders share the same filesystem. API returns: used=folder size, total=fs total, free=fs free
  const fsTotal = stats.length > 0 ? stats[0].total : 0;
  const fsFree = stats.length > 0 ? stats[0].free : 0;
  const fsUsed = fsTotal - fsFree;
  const pct = fsTotal > 0 ? (fsUsed / fsTotal) * 100 : 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <HardDrive className="h-3.5 w-3.5" />
          <Progress value={pct} className="w-24 h-2" />
          <span>{formatBytes(fsUsed)} / {formatBytes(fsTotal)}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          {stats.map((s) => (
            <div key={s.mount} className="text-xs">
              <span className="font-medium">{s.mount}:</span>{" "}
              {formatBytes(s.used)} / {formatBytes(s.total)} ({s.percent_used.toFixed(1)}%)
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function Header() {
  const title = usePageTitle();

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <MobileSidebar />
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <StorageSummary />
        <ThemeToggle />
      </div>
    </header>
  );
}
