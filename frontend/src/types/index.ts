// ---------------------------------------------------------------------------
// Scan types (mirrors backend Pydantic models)
// ---------------------------------------------------------------------------

export type ScanType =
  | "duplicates"
  | "similar-images"
  | "similar-videos"
  | "similar-music"
  | "empty-dirs"
  | "empty-files"
  | "temporary"
  | "symlinks"
  | "bad-extensions"
  | "broken";

export type ScanStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ScanOptions {
  search_method?: string;
  min_size?: number;
  similarity_preset?: string;
  tolerance?: number;
  music_similarity?: string;
  checked_types?: string[];
}

export interface ScanRequest {
  scan_type: ScanType;
  directories: string[];
  excluded_directories?: string[];
  options?: ScanOptions;
}

export interface ScanProgress {
  current_stage: string;
  current_file: string;
  files_processed: number;
  elapsed_seconds: number;
}

export interface ScanResult {
  id: string;
  scan_type: ScanType;
  status: ScanStatus;
  directories: string[];
  excluded_directories: string[];
  options: ScanOptions;
  progress: ScanProgress;
  results: unknown;
  findings_count: number;
  total_size: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

export interface FileDeleteRequest {
  paths: string[];
}

export interface FileTrashRequest {
  paths: string[];
}

export interface FileOperationResult {
  success: string[];
  failed: Array<{ path: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export interface StorageStat {
  mount: string;
  total: number;
  used: number;
  free: number;
  percent_used: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface AppConfig {
  default_directories: string[];
  default_excluded_directories: string[];
  trash_dir: string;
  thumbnail_cache_dir: string;
  max_thumbnail_size: [number, number];
}

// ---------------------------------------------------------------------------
// WebSocket messages
// ---------------------------------------------------------------------------

export interface WsProgressMessage extends ScanProgress {
  type?: undefined;
}

export interface WsPingMessage {
  type: "ping";
}

export interface WsDoneMessage {
  type: "done";
  status: ScanStatus;
}

export type WsMessage = WsProgressMessage | WsPingMessage | WsDoneMessage;
