import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { FolderOpen, CheckSquare, Square, Loader2 } from "lucide-react";
import { getStorageDirectories } from "@/lib/api";

interface StoragePath {
  path: string;
  name: string;
}

interface PathSelectorProps {
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
}

export function PathSelector({
  selected,
  onSelectionChange,
}: PathSelectorProps) {
  const [paths, setPaths] = useState<StoragePath[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStorageDirectories().then((dirs) => {
      setPaths(dirs);
      // Auto-select all on first load if nothing selected
      if (selected.length === 0 && dirs.length > 0) {
        onSelectionChange(dirs.map((d) => d.path));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allSelected = selected.length === paths.length && paths.length > 0;

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
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading directories...
          </div>
        ) : paths.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No storage directories found. Check your Docker volume mounts.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              {selected.length} of {paths.length} selected
            </p>
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
                </label>
              ))}
            </div>
          </>
        )}
        {!loading && selected.length === 0 && paths.length > 0 && (
          <p className="text-xs text-destructive mt-3">
            Select at least one directory to scan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
