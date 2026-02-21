import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes, formatDate, truncatePath } from "@/lib/utils";
import type { FileEntry } from "@/types";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface ResultsTableProps {
  files: FileEntry[];
  selectedFiles: Set<string>;
  onToggleFile: (path: string) => void;
  onSelectAll?: (paths: string[]) => void;
  onDeselectAll?: () => void;
}

type SortField = "name" | "size" | "path" | "date";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

export function ResultsTable({
  files,
  selectedFiles,
  onToggleFile,
  onSelectAll,
  onDeselectAll,
}: ResultsTableProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(0);
  }

  const filtered = useMemo(() => {
    if (!filter) return files;
    const lower = filter.toLowerCase();
    return files.filter(
      (f) =>
        f.path.toLowerCase().includes(lower) ||
        (f.path.split("/").pop() ?? "").toLowerCase().includes(lower),
    );
  }, [files, filter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const mult = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case "name": {
          const nameA = (a.path.split("/").pop() ?? "").toLowerCase();
          const nameB = (b.path.split("/").pop() ?? "").toLowerCase();
          return nameA.localeCompare(nameB) * mult;
        }
        case "size":
          return (a.size - b.size) * mult;
        case "path":
          return a.path.localeCompare(b.path) * mult;
        case "date":
          return (
            (new Date(a.modified).getTime() - new Date(b.modified).getTime()) *
            mult
          );
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageFiles = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
          placeholder="Filter by name or path..."
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    filtered.length > 0 &&
                    filtered.every((f) => selectedFiles.has(f.path))
                  }
                  ref={(el) => {
                    if (el) {
                      const someSelected = filtered.some((f) => selectedFiles.has(f.path));
                      const allSelected = filtered.length > 0 && filtered.every((f) => selectedFiles.has(f.path));
                      (el as unknown as HTMLInputElement).indeterminate = someSelected && !allSelected;
                    }
                  }}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onSelectAll?.(filtered.map((f) => f.path));
                    } else {
                      onDeselectAll?.();
                    }
                  }}
                />
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1 -ml-1 font-medium"
                  onClick={() => toggleSort("name")}
                >
                  Name <SortIcon field="name" />
                </Button>
              </TableHead>
              <TableHead className="hidden md:table-cell">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1 -ml-1 font-medium"
                  onClick={() => toggleSort("path")}
                >
                  Path <SortIcon field="path" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1 -ml-1 font-medium"
                  onClick={() => toggleSort("size")}
                >
                  Size <SortIcon field="size" />
                </Button>
              </TableHead>
              <TableHead className="hidden lg:table-cell text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1 -ml-1 font-medium"
                  onClick={() => toggleSort("date")}
                >
                  Modified <SortIcon field="date" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageFiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {filter ? "No files match filter" : "No files"}
                </TableCell>
              </TableRow>
            ) : (
              pageFiles.map((file) => {
                const fileName = file.path.split("/").pop() ?? file.path;
                return (
                  <TableRow
                    key={file.path}
                    className={
                      selectedFiles.has(file.path) ? "bg-primary/5" : ""
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedFiles.has(file.path)}
                        onCheckedChange={() => onToggleFile(file.path)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">
                      {fileName}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground font-mono truncate block max-w-[300px] cursor-help">
                            {truncatePath(file.path, 40)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-lg">
                          <p className="font-mono text-xs break-all">
                            {file.path}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatBytes(file.size)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-xs text-muted-foreground">
                      {formatDate(file.modified)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {sorted.length} file{sorted.length !== 1 ? "s" : ""}
            {filter && ` (filtered from ${files.length})`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
