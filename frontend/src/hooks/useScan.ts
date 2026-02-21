import { useCallback, useState } from "react";
import type {
  ScanProgress,
  ScanRequest,
  ScanResult,
  ScanStatus,
  ScanType,
} from "@/types";
import { cancelScan, createScan, getScan } from "@/lib/api";
import { useWebSocket } from "./useWebSocket";

type ScanPhase = "idle" | "configuring" | "running" | "completed" | "failed" | "cancelled";

interface UseScanReturn {
  phase: ScanPhase;
  scanId: string | null;
  progress: ScanProgress | null;
  result: ScanResult | null;
  error: string | null;
  startScan: (request: ScanRequest) => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
  wsConnected: boolean;
}

export function useScan(_scanType: ScanType): UseScanReturn {
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [scanId, setScanId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProgress = useCallback((p: ScanProgress) => {
    setProgress(p);
  }, []);

  const handleDone = useCallback(
    async (status: ScanStatus) => {
      if (status === "completed") {
        setPhase("completed");
      } else if (status === "failed") {
        setPhase("failed");
      } else if (status === "cancelled") {
        setPhase("cancelled");
      }
      // Fetch final results
      if (scanId) {
        try {
          const r = await getScan(scanId);
          setResult(r);
          if (r.error) setError(r.error);
        } catch {
          // ignore
        }
      }
    },
    [scanId],
  );

  const { connected: wsConnected } = useWebSocket({
    scanId: phase === "running" ? scanId : null,
    onProgress: handleProgress,
    onDone: handleDone,
  });

  const startScan = useCallback(async (request: ScanRequest) => {
    try {
      setError(null);
      setProgress(null);
      setResult(null);
      setPhase("running");
      const r = await createScan(request);
      setScanId(r.id);
      setResult(r);
    } catch (e) {
      setPhase("failed");
      setError(e instanceof Error ? e.message : "Failed to start scan");
    }
  }, []);

  const cancel = useCallback(async () => {
    if (!scanId) return;
    try {
      await cancelScan(scanId);
      setPhase("cancelled");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel scan");
    }
  }, [scanId]);

  const reset = useCallback(() => {
    setPhase("idle");
    setScanId(null);
    setProgress(null);
    setResult(null);
    setError(null);
  }, []);

  return {
    phase,
    scanId,
    progress,
    result,
    error,
    startScan,
    cancel,
    reset,
    wsConnected,
  };
}
