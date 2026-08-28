"use client";

import { Loader2, QrCode, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreatePairingToken, useDevices, useRevokeDevice } from "@/hooks/useDevices";
import { formatRelativeTime } from "@/lib/utils";

const REMOTE_URL_KEY = "cubicle_remote_url";

export function DevicesCard() {
  const { data: devices } = useDevices();
  const createPairingToken = useCreatePairingToken();
  const revokeDevice = useRevokeDevice();

  const [remoteUrl, setRemoteUrl] = useState("");
  const [pairing, setPairing] = useState<{ token: string; expiresAt: number } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    // localStorage isn't available during SSR — this fills in the real
    // value right after mount, same idiom as ThemeToggle.tsx's mounted-guard.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemoteUrl(window.localStorage.getItem(REMOTE_URL_KEY) ?? window.location.origin);
  }, []);

  useEffect(() => {
    if (!pairing) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((pairing.expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pairing]);

  function saveRemoteUrl(value: string) {
    setRemoteUrl(value);
    window.localStorage.setItem(REMOTE_URL_KEY, value);
  }

  async function handlePair() {
    try {
      const { token, expires_in } = await createPairingToken.mutateAsync();
      setPairing({ token, expiresAt: Date.now() + expires_in * 1000 });
    } catch {
      toast.error("Couldn't generate a pairing code — check the API logs");
    }
  }

  // A real link, not a JSON blob — any phone's stock camera app opens it
  // directly, and AuthGate auto-redeems the `pair` query param on load.
  const qrPayload = pairing ? `${remoteUrl.replace(/\/$/, "")}/?pair=${pairing.token}` : null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted p-4">
      <div>
        <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Smartphone className="size-3.5 text-primary" /> Devices
        </p>
        <p className="mt-0.5 text-3xs leading-relaxed text-slate-500 dark:text-slate-400">
          Pair a phone to control this instance remotely. Point it at whatever address reaches this
          server from outside — a Tailscale hostname, a Cloudflare Tunnel URL, or your VPS&apos;s domain.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="remote-url" className="text-3xs font-bold uppercase tracking-wider text-slate-400">
          Remote server address
        </Label>
        <Input
          id="remote-url"
          value={remoteUrl}
          onChange={(e) => saveRemoteUrl(e.target.value)}
          placeholder="https://your-host.ts.net"
          className="h-8 font-mono text-xs"
        />
      </div>

      {devices && devices.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {devices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">{device.name}</p>
                <p className="text-3xs text-slate-500 dark:text-slate-400">
                  Last seen {formatRelativeTime(device.last_seen_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-slate-400 hover:text-rose-500"
                onClick={() => revokeDevice.mutate(device.id)}
                aria-label={`Revoke ${device.name}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {pairing && qrPayload ? (
        secondsLeft > 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="rounded-lg bg-card p-3">
              <QRCode value={qrPayload} size={160} />
            </div>
            <p className="font-mono text-3xs break-all text-center text-slate-500 dark:text-slate-400">
              No camera? Open this link on the phone instead:
              <br />
              {qrPayload}
            </p>
            <p className="text-3xs font-semibold text-primary">
              Expires in {secondsLeft}s
            </p>
          </div>
        ) : (
          <p className="text-center text-3xs font-semibold text-amber-600 dark:text-amber-400">
            Code expired — generate a new one.
          </p>
        )
      ) : null}

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 text-xs font-bold"
        onClick={handlePair}
        disabled={createPairingToken.isPending}
      >
        {createPairingToken.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <QrCode className="size-3.5" />
        )}
        Pair a device
      </Button>
    </div>
  );
}
