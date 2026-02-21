import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PathSelector } from "@/components/scan/PathSelector";
import { ScanConfig } from "@/components/scan/ScanConfig";
import { ScanProgressView } from "@/components/scan/ScanProgress";
import { useScan } from "@/hooks/useScan";
import { SCAN_TYPE_LABELS, DEFAULT_EXCLUSIONS } from "@/lib/utils";
import type { ScanOptions, ScanType } from "@/types";
import { Play, Loader2 } from "lucide-react";

const DEFAULT_OPTIONS: Record<string, ScanOptions> = {
  duplicates: { search_method: "hash", hash_type: "blake3", min_size: 1048576 },
  "similar-images": { similarity_preset: "high" },
  "similar-videos": { tolerance: 10 },
  "similar-music": { music_similarity: "tags" },
};

export default function Scan() {
  const { type } = useParams<{ type: string }>();
  const scanType = (type ?? "duplicates") as ScanType;
  const label = SCAN_TYPE_LABELS[scanType] ?? scanType;

  const [selectedPaths, setSelectedPaths] = useState<string[]>([
    "/storage/video",
    "/storage/photos",
  ]);
  const [options, setOptions] = useState<ScanOptions>(
    DEFAULT_OPTIONS[scanType] ?? {},
  );
  const [exclusions, setExclusions] = useState(DEFAULT_EXCLUSIONS.join(", "));

  const {
    phase,
    scanId,
    progress,
    result,
    error,
    startScan,
    cancel,
    reset,
    wsConnected,
  } = useScan(scanType);

  async function handleStart() {
    const excludedDirs = exclusions
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    await startScan({
      scan_type: scanType,
      directories: selectedPaths,
      excluded_directories: excludedDirs,
      options,
    });
  }

  const isRunning = phase === "running";
  const showProgress = phase !== "idle";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-muted-foreground mt-1">
          Configure and start a {label.toLowerCase()} scan
        </p>
      </div>

      {/* Show progress/results if scan is active */}
      {showProgress && (
        <ScanProgressView
          phase={phase as "running" | "completed" | "failed" | "cancelled"}
          progress={progress}
          result={result}
          error={error}
          scanId={scanId}
          wsConnected={wsConnected}
          onCancel={cancel}
          onReset={reset}
        />
      )}

      {/* Configuration — only show when idle */}
      {phase === "idle" && (
        <>
          <PathSelector
            paths={[
              { path: "/storage/video", name: "Video", size: 2_500_000_000_000 },
              { path: "/storage/music", name: "Music", size: 150_000_000_000 },
              { path: "/storage/photos", name: "Photos", size: 800_000_000_000 },
              { path: "/storage/documents", name: "Documents", size: 50_000_000_000 },
              { path: "/storage/downloads", name: "Downloads", size: 200_000_000_000 },
              { path: "/storage/backup", name: "Backup", size: 1_000_000_000_000 },
            ]}
            selected={selectedPaths}
            onSelectionChange={setSelectedPaths}
          />

          <ScanConfig
            scanType={scanType}
            options={options}
            exclusions={exclusions}
            onOptionsChange={setOptions}
            onExclusionsChange={setExclusions}
          />

          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={handleStart}
            disabled={selectedPaths.length === 0 || isRunning}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Scan
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
