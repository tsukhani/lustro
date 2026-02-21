import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Copy,
  Image,
  Video,
  Music,
  FolderOpen,
  FileX,
  Trash2,
  Link2Off,
  FileWarning,
  FileMinus2,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import type { ScanType } from "@/types";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  scanType?: ScanType;
}

const SCAN_ITEMS: NavItem[] = [
  { to: "/scan/duplicates", label: "Duplicate Files", icon: <Copy className="h-4 w-4" />, scanType: "duplicates" },
  { to: "/scan/similar-images", label: "Similar Images", icon: <Image className="h-4 w-4" />, scanType: "similar-images" },
  { to: "/scan/similar-videos", label: "Similar Videos", icon: <Video className="h-4 w-4" />, scanType: "similar-videos" },
  { to: "/scan/similar-music", label: "Similar Music", icon: <Music className="h-4 w-4" />, scanType: "similar-music" },
  { to: "/scan/empty-dirs", label: "Empty Directories", icon: <FolderOpen className="h-4 w-4" />, scanType: "empty-dirs" },
  { to: "/scan/empty-files", label: "Empty Files", icon: <FileX className="h-4 w-4" />, scanType: "empty-files" },
  { to: "/scan/temporary", label: "Temporary Files", icon: <Trash2 className="h-4 w-4" />, scanType: "temporary" },
  { to: "/scan/symlinks", label: "Broken Symlinks", icon: <Link2Off className="h-4 w-4" />, scanType: "symlinks" },
  { to: "/scan/bad-extensions", label: "Bad Extensions", icon: <FileWarning className="h-4 w-4" />, scanType: "bad-extensions" },
  { to: "/scan/broken", label: "Broken Files", icon: <FileMinus2 className="h-4 w-4" />, scanType: "broken" },
];

const TOP_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
];

const BOTTOM_ITEMS: NavItem[] = [
  { to: "/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

function NavLinks({ onClick }: { onClick?: () => void }) {
  return (
    <ScrollArea className="flex-1">
      <nav className="space-y-1 px-3">
        {TOP_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            onClick={onClick}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}

        <Separator className="my-3" />
        <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Scan Types
        </p>

        {SCAN_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}

        <Separator className="my-3" />

        {BOTTOM_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </ScrollArea>
  );
}

function SidebarHeader() {
  return (
    <div className="px-6 py-5">
      <h2 className="text-xl font-bold tracking-tight">Czkawka</h2>
      <p className="text-xs text-muted-foreground">File Cleanup UI</p>
    </div>
  );
}

/** Desktop sidebar — always visible on md+ */
function DesktopSidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-64 border-r bg-card min-h-screen">
      <SidebarHeader />
      <NavLinks />
    </aside>
  );
}

/** Mobile sidebar — Sheet overlay triggered by hamburger */
function MobileSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarHeader />
        <NavLinks onClick={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function Sidebar() {
  return <DesktopSidebar />;
}

export { MobileSidebar };
