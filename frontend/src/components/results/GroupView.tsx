import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
import { FileCard } from "./FileCard";
import type { FileGroup } from "@/types";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";

interface GroupViewProps {
  groups: FileGroup[];
  selectedFiles: Set<string>;
  onToggleFile: (path: string) => void;
  onDeleteFile?: (path: string) => void;
}

function GroupCard({
  group,
  index,
  selectedFiles,
  onToggleFile,
  onDeleteFile,
}: {
  group: FileGroup;
  index: number;
  selectedFiles: Set<string>;
  onToggleFile: (path: string) => void;
  onDeleteFile?: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(index < 3); // first 3 expanded by default
  const selectedInGroup = group.files.filter((f) => selectedFiles.has(f.path)).length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <CardTitle className="text-sm font-medium">
              Group {index + 1}
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {group.files.length} files
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatBytes(group.total_size)}
            </span>
          </div>
          {selectedInGroup > 0 && (
            <Badge variant="default" className="text-xs">
              {selectedInGroup} selected
            </Badge>
          )}
        </CardHeader>
      </button>
      {expanded && (
        <CardContent className="pt-0 space-y-2 pb-3">
          {group.files.map((file, fileIdx) => (
            <div key={file.path} className="relative">
              {fileIdx === 0 && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2">
                  <Badge variant="outline" className="text-[10px] px-1">
                    Original
                  </Badge>
                </div>
              )}
              <div className={fileIdx === 0 ? "ml-14" : ""}>
                <FileCard
                  file={file}
                  selected={selectedFiles.has(file.path)}
                  onSelect={() => onToggleFile(file.path)}
                  onDelete={onDeleteFile}
                />
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export function GroupView({
  groups,
  selectedFiles,
  onToggleFile,
  onDeleteFile,
}: GroupViewProps) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <Layers className="h-10 w-10" />
          <p>No groups found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {groups.length} group{groups.length !== 1 ? "s" : ""} found
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => {
            /* handled at parent */
          }}
        >
          Expand All
        </Button>
      </div>
      {groups.map((group, idx) => (
        <GroupCard
          key={group.id}
          group={group}
          index={idx}
          selectedFiles={selectedFiles}
          onToggleFile={onToggleFile}
          onDeleteFile={onDeleteFile}
        />
      ))}
    </div>
  );
}
