import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ScanType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncatePath(path: string, maxLen = 50): string {
  if (path.length <= maxLen) return path;
  const parts = path.split("/");
  const filename = parts[parts.length - 1] ?? "";
  if (filename.length >= maxLen - 4) {
    return `...${filename.slice(-(maxLen - 3))}`;
  }
  const remaining = maxLen - filename.length - 4;
  const prefix = path.slice(0, remaining);
  return `${prefix}.../${filename}`;
}

export function getFileExtension(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? (parts[parts.length - 1] ?? "").toLowerCase() : "";
}

export function isImageFile(path: string): boolean {
  const ext = getFileExtension(path);
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "tiff", "ico"].includes(ext);
}

export const SCAN_TYPE_LABELS: Record<ScanType, string> = {
  dup: "Duplicate Files",
  "image": "Similar Images",
  "video": "Similar Videos",
  "music": "Similar Music",
  "empty-folders": "Empty Directories",
  "empty-files": "Empty Files",
  temp: "Temporary Files",
  symlinks: "Broken Symlinks",
  "ext": "Bad Extensions",
  broken: "Broken Files",
};

export const DEFAULT_EXCLUSIONS = [
  "@eaDir",
  ".Trash-*",
  "#recycle",
  ".DS_Store",
  "Thumbs.db",
  "node_modules",
];
