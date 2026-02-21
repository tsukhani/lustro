import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupView } from "@/components/results/GroupView";
import { ResultsTable } from "@/components/results/ResultsTable";
import {
  ActionToolbar,
  type SmartSelectStrategy,
} from "@/components/results/ActionToolbar";
import { getScan } from "@/lib/api";
import { deleteFiles, trashFiles } from "@/lib/api";
import {
  formatBytes,
  formatDate,
  formatDuration,
  SCAN_TYPE_LABELS,
} from "@/lib/utils";
import type {
  FileEntry,
  FileGroup,
  ScanResult,
  ScanResultData,
  GroupedResults,
  FlatResults,
} from "@/types";
import { GROUPED_SCAN_TYPES, isGroupedResults } from "@/types";
import {
  Loader2,
  ArrowLeft,
  Layers,
  List,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

/** Extract all files from result data */
function extractFiles(data: ScanResultData): FileEntry[] {
  if (isGroupedResults(data)) {
    return data.groups.flatMap((g) => g.files);
  }
  return (data as FlatResults).files;
}

/** Extract groups if data is grouped */
function extractGroups(data: ScanResultData): FileGroup[] | null {
  if (isGroupedResults(data)) {
    return (data as GroupedResults).groups;
  }
  return null;
}

export default function Results() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"groups" | "table">("groups");

  useEffect(() => {
    if (!scanId) return;
    setLoading(true);
    getScan(scanId)
      .then((data) => {
        setScan(data);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load results");
      })
      .finally(() => setLoading(false));
  }, [scanId]);

  const allFiles = useMemo(() => {
    if (!scan?.results) return [];
    return extractFiles(scan.results);
  }, [scan]);

  const groups = useMemo(() => {
    if (!scan?.results) return null;
    return extractGroups(scan.results);
  }, [scan]);

  const isGrouped =
    scan?.scan_type != null && GROUPED_SCAN_TYPES.includes(scan.scan_type);

  const toggleFile = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  const handleSmartSelect = useCallback(
    (strategy: SmartSelectStrategy) => {
      if (!groups) return;
      const toSelect = new Set<string>();

      for (const group of groups) {
        if (group.files.length < 2) continue;
        const sorted = [...group.files];

        switch (strategy) {
          case "keep-newest":
            sorted.sort(
              (a, b) =>
                new Date(b.modified).getTime() -
                new Date(a.modified).getTime(),
            );
            // Select all except the newest (first after sort)
            sorted.slice(1).forEach((f) => toSelect.add(f.path));
            break;
          case "keep-oldest":
            sorted.sort(
              (a, b) =>
                new Date(a.modified).getTime() -
                new Date(b.modified).getTime(),
            );
            sorted.slice(1).forEach((f) => toSelect.add(f.path));
            break;
          case "keep-largest":
            sorted.sort((a, b) => b.size - a.size);
            sorted.slice(1).forEach((f) => toSelect.add(f.path));
            break;
          case "keep-smallest":
            sorted.sort((a, b) => a.size - b.size);
            sorted.slice(1).forEach((f) => toSelect.add(f.path));
            break;
          case "select-all-except-one":
            // Keep first, select rest
            sorted.slice(1).forEach((f) => toSelect.add(f.path));
            break;
        }
      }

      setSelectedFiles(toSelect);
    },
    [groups],
  );

  async function handleDelete(paths: string[]) {
    try {
      const result = await deleteFiles({ paths });
      toast.success(
        `Deleted ${result.success.length} file${result.success.length !== 1 ? "s" : ""}`,
      );
      if (result.failed.length > 0) {
        toast.error(`Failed to delete ${result.failed.length} files`);
      }
      // Remove deleted files from selection
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        for (const p of result.success) {
          next.delete(p);
        }
        return next;
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to delete files",
      );
    }
  }

  async function handleTrash(paths: string[]) {
    try {
      const result = await trashFiles({ paths });
      toast.success(
        `Moved ${result.success.length} file${result.success.length !== 1 ? "s" : ""} to trash`,
      );
      if (result.failed.length > 0) {
        toast.error(`Failed to move ${result.failed.length} files`);
      }
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        for (const p of result.success) {
          next.delete(p);
        }
        return next;
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to move files to trash",
      );
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error || !scan) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p>{error ?? "Scan not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {SCAN_TYPE_LABELS[scan.scan_type]}
            </h1>
            <Badge
              variant={
                scan.status === "completed" ? "secondary" : "destructive"
              }
            >
              {scan.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span>{formatDate(scan.created_at)}</span>
            <span>{scan.findings_count} findings</span>
            <span>{formatBytes(scan.total_size)}</span>
            <span>{formatDuration(scan.progress.elapsed_seconds)}</span>
          </div>
        </div>
      </div>

      {/* View toggle */}
      {isGrouped && groups && groups.length > 0 ? (
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as "groups" | "table")}
        >
          <TabsList>
            <TabsTrigger value="groups" className="gap-1">
              <Layers className="h-3.5 w-3.5" /> Groups
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-1">
              <List className="h-3.5 w-3.5" /> Table
            </TabsTrigger>
          </TabsList>

          <TabsContent value="groups" className="mt-4">
            <GroupView
              groups={groups}
              selectedFiles={selectedFiles}
              onToggleFile={toggleFile}
            />
          </TabsContent>

          <TabsContent value="table" className="mt-4">
            <ResultsTable
              files={allFiles}
              selectedFiles={selectedFiles}
              onToggleFile={toggleFile}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <ResultsTable
          files={allFiles}
          selectedFiles={selectedFiles}
          onToggleFile={toggleFile}
        />
      )}

      {/* Action toolbar */}
      <ActionToolbar
        selectedFiles={selectedFiles}
        allFiles={allFiles}
        groups={groups ?? undefined}
        onDelete={handleDelete}
        onTrash={handleTrash}
        onClearSelection={clearSelection}
        onSmartSelect={handleSmartSelect}
      />
    </div>
  );
}
