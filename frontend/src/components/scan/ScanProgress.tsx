import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatDuration } from "@/lib/utils";
import type { ScanProgress as ScanProgressData, ScanResult } from "@/types";
import {
  Loader2,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Eye,
  RotateCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type Phase = "running" | "completed" | "failed" | "cancelled";

interface ScanProgressViewProps {
  phase: Phase;
  progress: ScanProgressData | null;
  result: ScanResult | null;
  error: string | null;
  scanId: string | null;
  wsConnected: boolean;
  onCancel: () => void;
  onReset: () => void;
}

export function ScanProgressView({
  phase,
  progress,
  result,
  error,
  scanId,
  wsConnected,
  onCancel,
  onReset,
}: ScanProgressViewProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          {phase === "running" && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          )}
          {phase === "completed" && (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          {phase === "failed" && (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
          {phase === "cancelled" && (
            <XCircle className="h-4 w-4 text-yellow-500" />
          )}
          {phase === "running"
            ? "Scanning..."
            : phase === "completed"
              ? "Scan Complete"
              : phase === "failed"
                ? "Scan Failed"
                : "Scan Cancelled"}
        </CardTitle>
        <div className="flex items-center gap-2">
          {wsConnected && (
            <Badge variant="outline" className="text-xs text-green-500 border-green-500/50">
              Live
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress indicators */}
        {phase === "running" && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {progress?.current_stage ?? "Preparing..."}
                </span>
                <span className="font-mono text-muted-foreground">
                  {formatDuration(progress?.elapsed_seconds ?? 0)}
                </span>
              </div>
              {/* Indeterminate progress */}
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="absolute inset-y-0 w-1/3 animate-pulse rounded-full bg-primary" 
                  style={{ animation: "shimmer 2s ease-in-out infinite" }} />
              </div>
            </div>

            {progress && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Files processed</span>
                  <p className="font-semibold text-lg">
                    {progress.files_processed.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Elapsed</span>
                  <p className="font-semibold text-lg">
                    {formatDuration(progress.elapsed_seconds)}
                  </p>
                </div>
              </div>
            )}

            {progress?.current_file && (
              <div className="text-xs text-muted-foreground font-mono truncate p-2 bg-muted/50 rounded">
                {progress.current_file}
              </div>
            )}

            <Button variant="destructive" size="sm" onClick={onCancel}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Scan
            </Button>
          </>
        )}

        {/* Completed summary */}
        {phase === "completed" && result && (
          <>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Findings</span>
                <p className="font-semibold text-lg">{result.findings_count}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Size</span>
                <p className="font-semibold text-lg">
                  {formatBytes(result.total_size)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Duration</span>
                <p className="font-semibold text-lg">
                  {formatDuration(result.progress.elapsed_seconds)}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {result.findings_count > 0 && scanId && (
                <Button onClick={() => navigate(`/results/${scanId}`)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Results
                </Button>
              )}
              <Button variant="outline" onClick={onReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                New Scan
              </Button>
            </div>
          </>
        )}

        {/* Failed */}
        {phase === "failed" && (
          <div className="space-y-3">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </p>
            )}
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {/* Cancelled */}
        {phase === "cancelled" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Scan was cancelled by user.
            </p>
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
