import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes, formatDate, isImageFile, truncatePath } from "@/lib/utils";
import { previewUrl } from "@/lib/api";
import type { FileEntry } from "@/types";
import { Trash2, FileIcon, ImageIcon } from "lucide-react";
import { useState } from "react";

interface FileCardProps {
  file: FileEntry;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onDelete?: (path: string) => void;
}

export function FileCard({ file, selected, onSelect, onDelete }: FileCardProps) {
  const [imgError, setImgError] = useState(false);
  const isImage = isImageFile(file.path);
  const fileName = file.path.split("/").pop() ?? file.path;

  return (
    <Card
      className={`flex items-center gap-3 p-3 transition-colors ${
        selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
      }`}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(checked) => onSelect(checked === true)}
      />

      {/* Thumbnail */}
      {isImage && !imgError ? (
        <div className="h-10 w-10 rounded overflow-hidden bg-muted shrink-0">
          <img
            src={previewUrl(file.path)}
            alt={fileName}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
          {isImage ? (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          ) : (
            <FileIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      )}

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-xs text-muted-foreground font-mono truncate cursor-help">
              {truncatePath(file.path)}
            </p>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-md">
            <p className="font-mono text-xs break-all">{file.path}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Size & date */}
      <div className="text-right shrink-0 hidden sm:block">
        <p className="text-sm font-medium">{formatBytes(file.size)}</p>
        <p className="text-xs text-muted-foreground">{formatDate(file.modified)}</p>
      </div>

      {/* Hash (if available) */}
      {file.hash && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[10px] text-muted-foreground font-mono hidden lg:inline">
              {file.hash.slice(0, 8)}…
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-mono text-xs">{file.hash}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Delete button */}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => onDelete(file.path)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </Card>
  );
}
