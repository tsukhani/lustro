import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { StorageStat } from "@/types";

interface StorageCardProps {
  stat: StorageStat;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function StorageCard({ stat }: StorageCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{stat.mount}</CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={stat.percent_used} className="mb-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatBytes(stat.used)} used</span>
          <span>{formatBytes(stat.free)} free</span>
          <span>{formatBytes(stat.total)} total</span>
        </div>
      </CardContent>
    </Card>
  );
}
