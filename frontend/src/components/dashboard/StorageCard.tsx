import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { StorageStat } from "@/types";
import { formatBytes } from "@/lib/utils";
import { HardDrive } from "lucide-react";

interface StorageCardProps {
  stat: StorageStat;
}

export function StorageCard({ stat }: StorageCardProps) {
  const pctColor =
    stat.percent_used > 90
      ? "text-red-500"
      : stat.percent_used > 75
        ? "text-yellow-500"
        : "text-green-500";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{stat.mount}</CardTitle>
        <HardDrive className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 mb-2">
          <span className={`text-2xl font-bold ${pctColor}`}>
            {stat.percent_used.toFixed(1)}%
          </span>
          <span className="text-xs text-muted-foreground">used</span>
        </div>
        <Progress value={stat.percent_used} className="mb-3 h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatBytes(stat.used)} used</span>
          <span>{formatBytes(stat.free)} free</span>
          <span>{formatBytes(stat.total)} total</span>
        </div>
      </CardContent>
    </Card>
  );
}
