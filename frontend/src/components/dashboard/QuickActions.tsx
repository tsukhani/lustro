import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScanType } from "@/types";
import {
  Copy,
  Image,
  FolderOpen,
  Trash2,
  FileMinus2,
  Zap,
} from "lucide-react";

interface QuickAction {
  type: ScanType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const QUICK_SCANS: QuickAction[] = [
  {
    type: "dup",
    label: "Duplicate Files",
    description: "Find files with identical content",
    icon: <Copy className="h-6 w-6" />,
    color: "text-blue-500",
  },
  {
    type: "image",
    label: "Similar Images",
    description: "Find visually similar images",
    icon: <Image className="h-6 w-6" />,
    color: "text-purple-500",
  },
  {
    type: "empty-folders",
    label: "Empty Directories",
    description: "Find empty folders to clean up",
    icon: <FolderOpen className="h-6 w-6" />,
    color: "text-yellow-500",
  },
  {
    type: "temp",
    label: "Temporary Files",
    description: "Find leftover temp files",
    icon: <Trash2 className="h-6 w-6" />,
    color: "text-orange-500",
  },
  {
    type: "broken",
    label: "Broken Files",
    description: "Find corrupted or broken files",
    icon: <FileMinus2 className="h-6 w-6" />,
    color: "text-red-500",
  },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Scan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {QUICK_SCANS.map((scan) => (
            <button
              key={scan.type}
              onClick={() => navigate(`/scan/${scan.type}`)}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-background hover:bg-accent hover:border-primary/50 transition-all text-center group"
            >
              <div className={`${scan.color} group-hover:scale-110 transition-transform`}>
                {scan.icon}
              </div>
              <span className="text-sm font-medium">{scan.label}</span>
              <span className="text-xs text-muted-foreground leading-tight">
                {scan.description}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
