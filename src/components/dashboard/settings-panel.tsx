"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ClientSummary = {
  id: string;
  name: string;
  domain: string;
  vertical: string;
  dataMode: "sample" | "real";
};

type SettingsPanelProps = {
  clientId: string;
  range: "7" | "30" | "90";
  clients: ClientSummary[];
  initialWindow: 7 | 14;
  initialSoftAttribution: boolean;
  initialDataMode: "sample" | "real";
};

export function SettingsPanel({
  clientId,
  range,
  clients,
  initialWindow,
  initialSoftAttribution,
  initialDataMode
}: SettingsPanelProps): JSX.Element {
  const router = useRouter();

  const [windowDays, setWindowDays] = useState<7 | 14>(initialWindow);
  const [useSoftAttribution, setUseSoftAttribution] = useState(initialSoftAttribution);
  const [workspaceMode, setWorkspaceMode] = useState<"sample" | "real">(initialDataMode);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const save = async (): Promise<void> => {
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientId,
          attributionWindowDays: windowDays,
          useSoftAttribution
        })
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setStatus("Saved");
      router.refresh();
    } catch (error) {
      console.error(error);
      setStatus("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const clearWorkspaceData = async (): Promise<void> => {
    setClearing(true);
    setStatus(null);

    try {
      const response = await fetch(`/api/admin/clients/${clientId}/clear`, {
        method: "POST"
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to clear workspace");
      }

      setWorkspaceMode("real");
      router.push(`/overview?clientId=${clientId}&range=${range}&notice=workspace-cleared`);
      router.refresh();
    } catch (error) {
      console.error(error);
      setStatus("Clear failed");
    } finally {
      setClearing(false);
      setClearDialogOpen(false);
    }
  };

  const resetSampleData = async (): Promise<void> => {
    setResetting(true);
    setStatus(null);

    try {
      const response = await fetch(`/api/admin/clients/${clientId}/resetSample`, {
        method: "POST"
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to reset sample data");
      }

      setWorkspaceMode("sample");
      router.push(`/settings?clientId=${clientId}&range=${range}&notice=sample-loaded`);
      router.refresh();
    } catch (error) {
      console.error(error);
      setStatus("Reset failed");
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Clients (read-only)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {clients.map((client) => {
              const active = client.id === clientId;
              return (
                <div key={client.id} className="rounded-lg border border-border/70 bg-[#0f1218cc] p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-medium">{client.name}</p>
                    <div className="flex items-center gap-2">
                      {active ? <Badge>Active</Badge> : null}
                      {active ? (
                        <Badge variant={workspaceMode === "real" ? "secondary" : "outline"}>
                          {workspaceMode === "real" ? "Real data" : "Sample"}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {client.domain} · {client.vertical}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Attribution Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Attribution window</Label>
              <div className="flex gap-2">
                <Button
                  variant={windowDays === 7 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setWindowDays(7)}
                >
                  7 days
                </Button>
                <Button
                  variant={windowDays === 14 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setWindowDays(14)}
                >
                  14 days
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-[#0f1218cc] p-3">
              <div>
                <p className="text-sm font-medium">Use soft attribution</p>
                <p className="text-xs text-muted-foreground">
                  Match by executive within attribution window when postId is missing.
                </p>
              </div>
              <Switch checked={useSoftAttribution} onCheckedChange={setUseSoftAttribution} />
            </div>

            <div className="space-y-2">
              <Button onClick={() => void save()} disabled={saving || resetting || clearing} className="w-full">
                {saving ? "Saving..." : "Save settings"}
              </Button>
              <Button
                variant="outline"
                onClick={() => void resetSampleData()}
                disabled={saving || resetting || clearing}
                className="w-full"
              >
                {resetting ? "Resetting..." : "Reset to sample data"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setClearDialogOpen(true)}
                disabled={saving || resetting || clearing}
                className="w-full"
              >
                {clearing ? "Clearing..." : "Clear workspace data"}
              </Button>
            </div>

            {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Clear workspace data?</DialogTitle>
            <DialogDescription>
              This deletes posts, inbound signals, meetings, opportunities, and reports for this client only.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-[#df551f66] bg-[#df551f17] p-3 text-sm text-[#ffc0a8]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <p>This cannot be undone. You can re-load sample rows with “Reset to sample data”.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setClearDialogOpen(false)} disabled={clearing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void clearWorkspaceData()} disabled={clearing}>
              {clearing ? "Clearing..." : "Clear workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
