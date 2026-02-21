import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ScanType } from "@/types";

const SCAN_LABELS: Record<ScanType, string> = {
  duplicates: "Duplicate Files",
  "similar-images": "Similar Images",
  "similar-videos": "Similar Videos",
  "similar-music": "Similar Music",
  "empty-dirs": "Empty Directories",
  "empty-files": "Empty Files",
  temporary: "Temporary Files",
  symlinks: "Broken Symlinks",
  "bad-extensions": "Bad Extensions",
  broken: "Broken Files",
};

export default function Scan() {
  const { type } = useParams<{ type: string }>();
  const scanType = type as ScanType;
  const label = SCAN_LABELS[scanType] ?? scanType;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{label}</h1>
        <p className="text-muted-foreground mt-1">
          Configure and start a scan
        </p>
      </div>

      {/* Scan configuration — placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Directories</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Select directories to scan. Path selector will be implemented here.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Options</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Type-specific scan options will appear here.
          </p>
        </CardContent>
      </Card>

      <Button size="lg" className="w-full sm:w-auto">
        Start Scan
      </Button>
    </div>
  );
}
