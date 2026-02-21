import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
import type { FileEntry, FileGroup } from "@/types";
import {
  Trash2,
  FolderInput,
  Download,
  ChevronDown,
  Sparkles,
  X,
} from "lucide-react";

interface ActionToolbarProps {
  selectedFiles: Set<string>;
  allFiles: FileEntry[];
  groups?: FileGroup[];
  onDelete: (paths: string[]) => void;
  onTrash: (paths: string[]) => void;
  onClearSelection: () => void;
  onSmartSelect: (strategy: SmartSelectStrategy) => void;
}

export type SmartSelectStrategy =
  | "keep-newest"
  | "keep-oldest"
  | "keep-largest"
  | "keep-smallest"
  | "select-all-except-one";

export function ActionToolbar({
  selectedFiles,
  allFiles,
  groups,
  onDelete,
  onTrash,
  onClearSelection,
  onSmartSelect,
}: ActionToolbarProps) {
  const [confirmAction, setConfirmAction] = useState<"delete" | "trash" | null>(
    null,
  );

  if (selectedFiles.size === 0) return null;

  const selectedSize = allFiles
    .filter((f) => selectedFiles.has(f.path))
    .reduce((acc, f) => acc + f.size, 0);

  const selectedPaths = Array.from(selectedFiles);

  function handleExportCSV() {
    const selected = allFiles.filter((f) => selectedFiles.has(f.path));
    const header = "path,size,modified\n";
    const rows = selected
      .map((f) => `"${f.path}",${f.size},"${f.modified}"`)
      .join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scan-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Fixed bottom toolbar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-lg p-3 md:left-64">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          {/* Selection info */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {selectedFiles.size} file{selectedFiles.size !== 1 ? "s" : ""}{" "}
              selected
            </Badge>
            <span className="text-sm text-muted-foreground">
              ({formatBytes(selectedSize)})
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClearSelection}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Smart select */}
            {groups && groups.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Sparkles className="h-4 w-4 mr-1" />
                    Smart Select
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onSmartSelect("keep-newest")}>
                    Keep Newest
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSmartSelect("keep-oldest")}>
                    Keep Oldest
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onSmartSelect("keep-largest")}>
                    Keep Largest
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSmartSelect("keep-smallest")}>
                    Keep Smallest
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onSmartSelect("select-all-except-one")}
                  >
                    Select All Except One Per Group
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Export CSV */}
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>

            {/* Move to trash */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmAction("trash")}
            >
              <FolderInput className="h-4 w-4 mr-1" />
              Move to Trash
            </Button>

            {/* Delete */}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmAction("delete")}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Selected
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={() => setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "delete"
                ? "Delete Files Permanently?"
                : "Move Files to Trash?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "delete" ? (
                <>
                  This will <strong>permanently delete</strong>{" "}
                  {selectedFiles.size} file{selectedFiles.size !== 1 ? "s" : ""}{" "}
                  ({formatBytes(selectedSize)}). This action cannot be undone.
                </>
              ) : (
                <>
                  This will move {selectedFiles.size} file
                  {selectedFiles.size !== 1 ? "s" : ""} (
                  {formatBytes(selectedSize)}) to the trash directory. You can
                  restore them later.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmAction === "delete"
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : ""
              }
              onClick={() => {
                if (confirmAction === "delete") {
                  onDelete(selectedPaths);
                } else {
                  onTrash(selectedPaths);
                }
                setConfirmAction(null);
              }}
            >
              {confirmAction === "delete" ? "Delete Permanently" : "Move to Trash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
