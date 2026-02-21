import { StorageCard } from "@/components/dashboard/StorageCard";
import { RecentScans } from "@/components/dashboard/RecentScans";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { useStorage } from "@/hooks/useStorage";
import { Loader2 } from "lucide-react";
import type { StorageStat } from "@/types";

/** Mock storage data — used when backend isn't available */
const MOCK_STORAGE: StorageStat[] = [
  {
    mount: "/storage/video",
    total: 4_000_000_000_000,
    used: 3_200_000_000_000,
    free: 800_000_000_000,
    percent_used: 80,
  },
  {
    mount: "/storage/music",
    total: 500_000_000_000,
    used: 150_000_000_000,
    free: 350_000_000_000,
    percent_used: 30,
  },
  {
    mount: "/storage/photos",
    total: 1_000_000_000_000,
    used: 780_000_000_000,
    free: 220_000_000_000,
    percent_used: 78,
  },
  {
    mount: "/storage/documents",
    total: 200_000_000_000,
    used: 45_000_000_000,
    free: 155_000_000_000,
    percent_used: 22.5,
  },
];

export default function Dashboard() {
  const { stats, loading, error } = useStorage();

  // Use real stats if available, fall back to mock
  const storageStats = stats.length > 0 ? stats : MOCK_STORAGE;
  const isMock = stats.length === 0 && !loading;

  return (
    <div className="space-y-6">
      {/* Storage overview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Storage Overview</h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {isMock && !error && (
            <span className="text-xs text-muted-foreground">
              Showing sample data — connect backend for live stats
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {storageStats.map((stat) => (
            <StorageCard key={stat.mount} stat={stat} />
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <QuickActions />

      {/* Recent scans */}
      <RecentScans />
    </div>
  );
}
