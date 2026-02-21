import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import type { ScanType } from "@/types";

const QUICK_SCANS: Array<{ type: ScanType; label: string; description: string }> = [
  { type: "duplicates", label: "Duplicate Files", description: "Find files with identical content" },
  { type: "similar-images", label: "Similar Images", description: "Find visually similar images" },
  { type: "empty-dirs", label: "Empty Directories", description: "Find empty folders to clean up" },
  { type: "temporary", label: "Temporary Files", description: "Find leftover temp files" },
  { type: "broken", label: "Broken Files", description: "Find corrupted/broken files" },
];

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Storage overview and quick actions
        </p>
      </div>

      {/* Storage overview — placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Storage stats will appear here once connected to the backend.
          </p>
        </CardContent>
      </Card>

      {/* Quick scan buttons */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Scan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_SCANS.map((scan) => (
            <Card
              key={scan.type}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => navigate(`/scan/${scan.type}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{scan.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{scan.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent scans — placeholder */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Scans</h2>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No scans yet. Start one above!
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
