import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Results() {
  const { scanId } = useParams<{ scanId: string }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scan Results</h1>
        <p className="text-muted-foreground mt-1">
          Scan ID: <code className="text-xs">{scanId}</code>
        </p>
      </div>

      {/* Results display — placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Scan results, grouped display, file cards, and action toolbar will be implemented here.
          </p>
        </CardContent>
      </Card>

      {/* Action toolbar — placeholder */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">
          Actions: Delete Selected · Move to Trash · Export CSV
        </span>
      </div>
    </div>
  );
}
