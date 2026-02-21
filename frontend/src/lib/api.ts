/**
 * API client — typed fetch wrapper for the Czkawka backend.
 */

import type {
  AppConfig,
  FileDeleteRequest,
  FileOperationResult,
  FileTrashRequest,
  ScanRequest,
  ScanResult,
  StorageStat,
} from "@/types";

const BASE = "/api";

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Scans
// ---------------------------------------------------------------------------

export function createScan(data: ScanRequest) {
  return request<ScanResult>("/scans", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listScans() {
  return request<ScanResult[]>("/scans");
}

export function getScan(id: string) {
  return request<ScanResult>(`/scans/${id}`);
}

export function cancelScan(id: string) {
  return request<ScanResult>(`/scans/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

export function deleteFiles(data: FileDeleteRequest) {
  return request<FileOperationResult>("/files/delete", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function trashFiles(data: FileTrashRequest) {
  return request<FileOperationResult>("/files/trash", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function previewUrl(path: string) {
  return `${BASE}/files/preview${path}`;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export function getStorageStats() {
  return request<StorageStat[]>("/storage/stats");
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function getConfig() {
  return request<AppConfig>("/config");
}

export function updateConfig(config: AppConfig) {
  return request<AppConfig>("/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}
