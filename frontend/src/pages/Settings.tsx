import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { getConfig, updateConfig } from "@/lib/api";
import type { AppConfig } from "@/types";
import { Save, Loader2, FolderOpen, Ban, Trash2, X, Plus } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_CONFIG: AppConfig = {
  default_directories: ["/storage/video", "/storage/music", "/storage/photos"],
  default_excluded_directories: [
    "@eaDir",
    ".Trash-*",
    "#recycle",
    ".DS_Store",
    "Thumbs.db",
    "node_modules",
  ],
  trash_dir: "/config/trash",
  thumbnail_cache_dir: "/config/thumbnails",
  max_thumbnail_size: [200, 200],
};

export default function Settings() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDir, setNewDir] = useState("");
  const [newExclusion, setNewExclusion] = useState("");

  useEffect(() => {
    getConfig()
      .then((data) => setConfig(data))
      .catch(() => {
        // Use defaults if backend not available
        setConfig(DEFAULT_CONFIG);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      const updated = await updateConfig(config);
      setConfig(updated);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to save settings",
      );
    } finally {
      setSaving(false);
    }
  }

  function addDirectory() {
    if (!newDir.trim()) return;
    setConfig({
      ...config,
      default_directories: [...config.default_directories, newDir.trim()],
    });
    setNewDir("");
  }

  function removeDirectory(dir: string) {
    setConfig({
      ...config,
      default_directories: config.default_directories.filter((d) => d !== dir),
    });
  }

  function addExclusion() {
    if (!newExclusion.trim()) return;
    setConfig({
      ...config,
      default_excluded_directories: [
        ...config.default_excluded_directories,
        newExclusion.trim(),
      ],
    });
    setNewExclusion("");
  }

  function removeExclusion(exc: string) {
    setConfig({
      ...config,
      default_excluded_directories: config.default_excluded_directories.filter(
        (e) => e !== exc,
      ),
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Default directories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Default Scan Directories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {config.default_directories.map((dir) => (
              <Badge
                key={dir}
                variant="secondary"
                className="gap-1 text-xs font-mono"
              >
                {dir}
                <button
                  onClick={() => removeDirectory(dir)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newDir}
              onChange={(e) => setNewDir(e.target.value)}
              placeholder="/storage/new-path"
              className="font-mono text-sm"
              onKeyDown={(e) => e.key === "Enter" && addDirectory()}
            />
            <Button variant="outline" size="icon" onClick={addDirectory}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Exclusion patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="h-4 w-4" />
            Default Exclusions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Patterns to exclude from all scans by default
          </p>
          <div className="flex flex-wrap gap-2">
            {config.default_excluded_directories.map((exc) => (
              <Badge
                key={exc}
                variant="outline"
                className="gap-1 text-xs font-mono"
              >
                {exc}
                <button
                  onClick={() => removeExclusion(exc)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newExclusion}
              onChange={(e) => setNewExclusion(e.target.value)}
              placeholder="pattern"
              className="font-mono text-sm"
              onKeyDown={(e) => e.key === "Enter" && addExclusion()}
            />
            <Button variant="outline" size="icon" onClick={addExclusion}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trash settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Trash Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Trash Directory</Label>
            <Input
              value={config.trash_dir}
              onChange={(e) =>
                setConfig({ ...config, trash_dir: e.target.value })
              }
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Files moved to trash are stored here with metadata for potential
              restoration
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Thumbnail Cache Directory</Label>
            <Input
              value={config.thumbnail_cache_dir}
              onChange={(e) =>
                setConfig({ ...config, thumbnail_cache_dir: e.target.value })
              }
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Save Settings
      </Button>
    </div>
  );
}
