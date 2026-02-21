import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanProgress, ScanStatus, WsMessage } from "@/types";

interface UseWebSocketOptions {
  scanId: string | null;
  onProgress?: (progress: ScanProgress) => void;
  onDone?: (status: ScanStatus) => void;
}

export function useWebSocket({
  scanId,
  onProgress,
  onDone,
}: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const maxRetries = 5;

  const connect = useCallback(() => {
    if (!scanId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/scans/${scanId}/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data: WsMessage = JSON.parse(event.data as string);
        if ("type" in data && data.type === "ping") return;
        if ("type" in data && data.type === "done") {
          onDone?.(data.status);
          return;
        }
        onProgress?.(data as ScanProgress);
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // Reconnect logic
      if (retriesRef.current < maxRetries) {
        retriesRef.current += 1;
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 10000);
        setTimeout(() => {
          connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [scanId, onProgress, onDone]);

  const disconnect = useCallback(() => {
    retriesRef.current = maxRetries; // prevent reconnect
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      retriesRef.current = maxRetries;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return { connected, disconnect };
}
