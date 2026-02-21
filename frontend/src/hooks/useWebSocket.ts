import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanProgress, WsMessage } from "@/types";

interface UseWebSocketOptions {
  scanId: string | null;
  onProgress?: (progress: ScanProgress) => void;
  onDone?: (status: string) => void;
}

export function useWebSocket({ scanId, onProgress, onDone }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!scanId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/scans/${scanId}/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data: WsMessage = JSON.parse(event.data);
        if ("type" in data && data.type === "ping") return;
        if ("type" in data && data.type === "done") {
          onDone?.(data.status);
          return;
        }
        // Progress update
        onProgress?.(data as ScanProgress);
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [scanId, onProgress, onDone]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { connected, disconnect };
}
