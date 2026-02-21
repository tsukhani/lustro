import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { FolderOpen, CheckSquare, Square } from "lucide-react";

interface StoragePath {
  path: string;
  name: string;
  size?: number;
}

interface PathSelectorProps {
  paths: StoragePath[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
}

/** Default mock paths representing typical NAS storage volumes */
const DEFAULT_PATHS: StoragePath[] = [
  { path: "/storage/video", name: "Video", size: 2_500_000_000_000 },
  { path: "/storage/music", name: "Music", size: 150_000_000_000 },
  { path: "/storage/photos", name: "Photos", size: 800_000_000_000 },
  { path: "/storage/documents", name: "Documents", size: 50_000_000_000 },
  { path: "/storage/downloads", name: "Downloads", size: 200_000_000_000 },
  { path: "/storage/backup", name: "Backup", size: 1_000_000_000_000 },
];

export function PathSelector({
  paths = DEFAULT_PATHS,
  selected,
  onSelectionChange,
}: PathSelectorProps) {
  const allSelected = selected.length === paths.length && paths.length > 0;
  const someSelected = selected.length > 0 && selected.length < paths.length;

  function togglePath(path: string) {
    if (selected.includes(path)) {
      onSelectionChange(selected.filter((p) => p !== path));
    } else {
      onSelectionChange([...selected, path]);
    }
  }

  function selectAll() {
    onSelectionChange(paths.map((p) => p.path));
  }

  function deselectAll() {
    onSelectionChange([]);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderOpen className="h-4 w-4" />
          Directories to Scan
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            disabled={allSelected}
            className="text-xs h-7"
          >
            <CheckSquare className="h-3 w-3 mr-1" />
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={deselectAll}
            disabled={selected.length === 0}
            className="text-xs h-7"
          >
            <Square className="h-3 w-3 mr-1" />
            None
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {someSelected && (
          <p className="text-xs text-muted-foreground mb-3">
            {selected.length} of {paths.length} selected
          </p>
        )}
        <div className="space-y-2">
          {paths.map((p) => (
            <label
              key={p.path}
              className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selected.includes(p.path)}
                onCheckedChange={() => togglePath(p.path)}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {p.path}
                </div>
              </div>
              {p.size != null && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatBytes(p.size)}
                </span>
              )}
            </label>
          ))}
        </div>
        {selected.length === 0 && (
          <p className="text-xs text-destructive mt-3">
            Select at least one directory to scan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
