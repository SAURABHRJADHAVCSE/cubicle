"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";

export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        toast.error(err.message || "Incorrect current password");
      } else {
        toast.error("Couldn't change the password — check the API logs");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-muted p-4"
    >
      <div>
        <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <KeyRound className="size-3.5 text-primary" /> Instance Password
        </p>
        <p className="mt-0.5 text-3xs leading-relaxed text-slate-500 dark:text-slate-400">
          Changing this doesn&apos;t sign out devices already paired — revoke a specific one above if needed.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="current-password" className="text-3xs font-bold text-slate-600 dark:text-slate-400">
            Current password
          </Label>
          <Input
            id="current-password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password" className="text-3xs font-bold text-slate-600 dark:text-slate-400">
            New password
          </Label>
          <Input
            id="new-password"
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-new-password" className="text-3xs font-bold text-slate-600 dark:text-slate-400">
            Confirm new password
          </Label>
          <Input
            id="confirm-new-password"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-8"
          />
        </div>
      </div>

      <Button type="submit" size="sm" disabled={submitting} className="self-start text-xs font-bold">
        {submitting ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
