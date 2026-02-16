"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ClientSummary = {
  id: string;
  name: string;
  domain: string;
  vertical: string;
};

type SettingsPanelProps = {
  clientId: string;
  clients: ClientSummary[];
  initialWindow: 7 | 14;
  initialSoftAttribution: boolean;
};

export function SettingsPanel({
  clientId,
  clients,
  initialWindow,
  initialSoftAttribution
}: SettingsPanelProps): JSX.Element {
  const router = useRouter();

  const [windowDays, setWindowDays] = useState<7 | 14>(initialWindow);
  const [useSoftAttribution, setUseSoftAttribution] = useState(initialSoftAttribution);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
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

  const resetSampleData = async (): Promise<void> => {
    const confirmed = window.confirm(
      "Reset this client to sample data? This will replace existing posts, inbound signals, meetings, opportunities, and reports for this client."
    );

    if (!confirmed) {
      return;
    }

    setResetting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/settings/reset-sample", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to reset sample data");
      }

      setStatus("Sample data loaded");
      router.refresh();
    } catch (error) {
      console.error(error);
      setStatus("Reset failed");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Clients (read-only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {clients.map((client) => (
            <div key={client.id} className="rounded-lg border border-border/70 bg-[#0f1218cc] p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="font-medium">{client.name}</p>
                {client.id === clientId ? <Badge>Active</Badge> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {client.domain} · {client.vertical}
              </p>
            </div>
          ))}
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
              <p className="text-xs text-muted-foreground">Match by executive within attribution window when postId is missing.</p>
            </div>
            <Switch checked={useSoftAttribution} onCheckedChange={setUseSoftAttribution} />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button onClick={() => void save()} disabled={saving || resetting}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
            <Button variant="outline" onClick={() => void resetSampleData()} disabled={saving || resetting}>
              {resetting ? "Resetting..." : "Reset to sample data"}
            </Button>
          </div>

          {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
