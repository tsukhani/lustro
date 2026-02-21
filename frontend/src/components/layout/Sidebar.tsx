import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/scan/duplicates", label: "Duplicates", icon: "📄" },
  { to: "/scan/similar-images", label: "Similar Images", icon: "🖼️" },
  { to: "/scan/similar-videos", label: "Similar Videos", icon: "🎬" },
  { to: "/scan/similar-music", label: "Similar Music", icon: "🎵" },
  { to: "/scan/empty-dirs", label: "Empty Dirs", icon: "📁" },
  { to: "/scan/empty-files", label: "Empty Files", icon: "📃" },
  { to: "/scan/temporary", label: "Temp Files", icon: "🗑️" },
  { to: "/scan/broken", label: "Broken Files", icon: "💔" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-card min-h-screen p-4 hidden md:block">
      <div className="mb-8">
        <h2 className="text-xl font-bold">Czkawka</h2>
        <p className="text-xs text-muted-foreground">File Cleanup UI</p>
      </div>
      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
