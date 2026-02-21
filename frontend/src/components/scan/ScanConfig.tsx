import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Settings2 } from "lucide-react";
import type { ScanOptions, ScanType } from "@/types";
import { DEFAULT_EXCLUSIONS } from "@/lib/utils";

interface ScanConfigProps {
  scanType: ScanType;
  options: ScanOptions;
  exclusions: string;
  onOptionsChange: (options: ScanOptions) => void;
  onExclusionsChange: (exclusions: string) => void;
}

function DuplicatesConfig({
  options,
  onChange,
}: {
  options: ScanOptions;
  onChange: (o: ScanOptions) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Check Method</Label>
        <Select
          value={options.search_method ?? "hash"}
          onValueChange={(v) => onChange({ ...options, search_method: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hash">Hash (most accurate)</SelectItem>
            <SelectItem value="size">Size only (fast)</SelectItem>
            <SelectItem value="name">Name only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {options.search_method === "hash" && (
        <div className="space-y-2">
          <Label>Hash Type</Label>
          <Select
            value={options.hash_type ?? "blake3"}
            onValueChange={(v) => onChange({ ...options, hash_type: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blake3">BLAKE3 (fastest)</SelectItem>
              <SelectItem value="crc32">CRC32 (fast)</SelectItem>
              <SelectItem value="xxh3">XXH3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Minimum File Size</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={options.min_size ?? 1048576}
            onChange={(e) =>
              onChange({ ...options, min_size: Number(e.target.value) })
            }
            className="w-32"
          />
          <span className="text-sm text-muted-foreground">bytes (1 MB default)</span>
        </div>
      </div>
    </div>
  );
}

function SimilarImagesConfig({
  options,
  onChange,
}: {
  options: ScanOptions;
  onChange: (o: ScanOptions) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Similarity Preset</Label>
        <Select
          value={options.similarity_preset ?? "high"}
          onValueChange={(v) => onChange({ ...options, similarity_preset: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minimal">Minimal (fewest matches)</SelectItem>
            <SelectItem value="very_small">Very Small</SelectItem>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="very_high">Very High (most matches)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Higher similarity = more potential matches but also more false positives
        </p>
      </div>
    </div>
  );
}

function SimilarVideosConfig({
  options,
  onChange,
}: {
  options: ScanOptions;
  onChange: (o: ScanOptions) => void;
}) {
  const tolerance = options.tolerance ?? 10;
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Tolerance</Label>
          <span className="text-sm text-muted-foreground">{tolerance}</span>
        </div>
        <Slider
          value={[tolerance]}
          onValueChange={(v) => onChange({ ...options, tolerance: v[0] })}
          min={1}
          max={20}
          step={1}
        />
        <p className="text-xs text-muted-foreground">
          Lower = stricter matching, Higher = more matches
        </p>
      </div>
    </div>
  );
}

function SimilarMusicConfig({
  options,
  onChange,
}: {
  options: ScanOptions;
  onChange: (o: ScanOptions) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Music Similarity</Label>
        <Select
          value={options.music_similarity ?? "tags"}
          onValueChange={(v) => onChange({ ...options, music_similarity: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tags">By Tags (title, artist, etc.)</SelectItem>
            <SelectItem value="content">By Content (audio fingerprint)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function MinimalConfig() {
  return (
    <p className="text-sm text-muted-foreground">
      No additional configuration needed for this scan type.
    </p>
  );
}

export function ScanConfig({
  scanType,
  options,
  exclusions,
  onOptionsChange,
  onExclusionsChange,
}: ScanConfigProps) {
  function renderTypeConfig() {
    switch (scanType) {
      case "dup":
        return <DuplicatesConfig options={options} onChange={onOptionsChange} />;
      case "image":
        return <SimilarImagesConfig options={options} onChange={onOptionsChange} />;
      case "video":
        return <SimilarVideosConfig options={options} onChange={onOptionsChange} />;
      case "music":
        return <SimilarMusicConfig options={options} onChange={onOptionsChange} />;
      default:
        return <MinimalConfig />;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Scan Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderTypeConfig()}

        <div className="space-y-2">
          <Label>Exclusion Patterns</Label>
          <Input
            value={exclusions}
            onChange={(e) => onExclusionsChange(e.target.value)}
            placeholder="@eaDir, .Trash-*, node_modules"
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated patterns. Defaults: {DEFAULT_EXCLUSIONS.join(", ")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
