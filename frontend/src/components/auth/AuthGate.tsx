"use client";

import { Building2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";
import { getAuthToken, onAuthTokenChange, setAuthToken } from "@/lib/authToken";

/** Gates the whole app behind the instance setup password. Renders nothing
 * of `children` until a valid device token exists in this browser — mirrors
 * the same bearer-token check the backend enforces on every API route
 * (app/api/deps.py) and the Socket.io connection (app/ws/manager.py). */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [passwordSet, setPasswordSet] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Distinct from `submitting` (form submission) — this is redeeming a
  // `?pair=` link from a scanned QR code, which needs its own loading state
  // since it happens before the form even renders.
  const [autoPairing, setAutoPairing] = useState(false);

  useEffect(() => {
    // localStorage isn't available during SSR — read the real value right
    // after mount, same idiom as ThemeToggle.tsx's mounted-guard.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(getAuthToken());
    return onAuthTokenChange(setToken);
  }, []);

  useEffect(() => {
    const pairToken = new URLSearchParams(window.location.search).get("pair");
    if (!pairToken) return;

    // Strip it immediately so a refresh (or a failed redeem falling through
    // to the login form) can't replay an already-spent single-use token.
    const url = new URL(window.location.href);
    url.searchParams.delete("pair");
    window.history.replaceState(null, "", url.toString());

    // Kicking off a real async redeem, not just syncing post-mount browser
    // state — the loading flag has to flip before the request starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoPairing(true);
    const deviceName = typeof navigator !== "undefined" ? `Mobile — ${navigator.platform || "device"}` : "Mobile device";
    api.devices
      .pair(pairToken, deviceName)
      .then((result) => setAuthToken(result.token))
      .catch(() => toast.error("This pairing link is invalid or has expired — ask for a new QR code."))
      .finally(() => setAutoPairing(false));
  }, []);

  useEffect(() => {
    if (token || checked || autoPairing) return;
    api.auth
      .status()
      .then((s) => setPasswordSet(s.password_set))
      .catch(() => setPasswordSet(false))
      .finally(() => setChecked(true));
  }, [token, checked, autoPairing]);

  if (token) return <>{children}</>;
  if (autoPairing || !checked) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordSet && password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      const deviceName =
        typeof navigator !== "undefined" ? `Web — ${navigator.platform || "browser"}` : "Web browser";
      const result = await (passwordSet
        ? api.auth.login(password, deviceName)
        : api.auth.setup(password, deviceName));
      setAuthToken(result.token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error("Incorrect password");
      } else if (err instanceof ApiError && err.status === 400) {
        toast.error(err.message || "Password must be at least 8 characters");
      } else {
        toast.error("Couldn't reach the Cubicle server");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-bg flex h-screen w-screen items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="glass-panel w-full max-w-sm rounded-2xl border border-border bg-card/90 p-6 shadow-xl"
      >
        <div className="mb-5 flex flex-col items-center text-center">
          {/* Same engraved-plaque mark as the header nameplate — the first
              thing a visitor sees should already look like this app's
              paperwork, not a generic gradient app icon. */}
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.58_0.24_292)] text-white shadow-[0_4px_16px_color-mix(in_oklab,var(--primary)_40%,transparent),inset_0_1px_1px_color-mix(in_oklab,white_35%,transparent),inset_0_-1.5px_2px_color-mix(in_oklab,black_25%,transparent)]">
            <Building2 className="size-5" strokeWidth={2.2} />
          </div>
          <h1 className="font-heading text-lg font-extrabold tracking-tight text-foreground">
            {passwordSet ? "Welcome back" : "Set up Cubicle"}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {passwordSet
              ? "Enter your instance password to continue."
              : "Choose a password — it's what protects this instance and pairs your devices."}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="instance-password" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                id="instance-password"
                type="password"
                autoFocus
                required
                minLength={passwordSet ? undefined : 8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 pl-8"
              />
            </div>
          </div>

          {!passwordSet && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="instance-password-confirm" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Confirm password
              </Label>
              <Input
                id="instance-password-confirm"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10"
              />
            </div>
          )}

          <Button type="submit" disabled={submitting} className="mt-1 h-10 font-bold">
            {submitting ? "Please wait…" : passwordSet ? "Log in" : "Set password & continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
