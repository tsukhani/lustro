import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listScans } from "@/lib/api";
import { formatBytes, formatDate, SCAN_TYPE_LABELS } from "@/lib/utils";
import type { ScanResult, ScanStatus } from "@/types";
import { ArrowRight, Clock, FileSearch } from "lucide-react";

const STATUS_VARIANT: Record<ScanStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  running: "default",
  completed: "secondary",
  failed: "destructive",
  cancelled: "outline",
};

export function RecentScans() {
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    listScans()
      .then((data) => {
        // Show most recent first, limit to 5
        const sorted = [...data].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setScans(sorted.slice(0, 5));
      })
      .catch(() => {
        // API not available yet — use empty list
        setScans([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Scans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (scans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Scans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <FileSearch className="h-10 w-10" />
            <p>No scans yet. Start one from the sidebar!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Scans
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {scans.map((scan) => (
          <div
            key={scan.id}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">
                  {SCAN_TYPE_LABELS[scan.scan_type]}
                </span>
                <Badge variant={STATUS_VARIANT[scan.status]} className="text-xs">
                  {scan.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{formatDate(scan.created_at)}</span>
                {scan.findings_count > 0 && (
                  <span>
                    {scan.findings_count} findings · {formatBytes(scan.total_size)}
                  </span>
                )}
              </div>
            </div>
            {scan.status === "completed" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/results/${scan.id}`)}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
