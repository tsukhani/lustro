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
  dup: { search_method: "hash", hash_type: "blake3", min_size: 1048576 },
  "image": { similarity_preset: "high" },
  "video": { tolerance: 10 },
  "music": { music_similarity: "tags" },
};

// Map old URL names to v11 names for backwards compatibility
const LEGACY_TYPE_MAP: Record<string, string> = {
  duplicates: "dup",
  "similar-images": "image",
  "similar-videos": "video",
  "similar-music": "music",
  "empty-dirs": "empty-folders",
  temporary: "temp",
  "bad-extensions": "ext",
};

export default function Scan() {
  const { type } = useParams<{ type: string }>();
  const rawType = type ?? "dup";
  const scanType = (LEGACY_TYPE_MAP[rawType] ?? rawType) as ScanType;
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
