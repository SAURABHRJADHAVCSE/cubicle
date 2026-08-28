"use client";

import { Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AppearanceSettingsCard() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Same SSR-hydration guard as ThemeToggle.tsx — see its comment.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Card className="glass-panel border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 p-4 rounded-lg shadow-sm">
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <Palette className="size-4 text-primary" />
          <CardTitle className="font-heading text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
            Appearance & Theme
          </CardTitle>
        </div>
        <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
          Switch between Light and Dark office themes and customize 3D viewport aesthetics.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-0 pt-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-3">
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">Workspace Color Mode</p>
            <p className="text-3xs text-slate-500 dark:text-slate-400">Current theme: <span className="font-semibold uppercase">{resolvedTheme}</span></p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={resolvedTheme === "light" ? "default" : "outline"}
              className={`gap-1.5 rounded-lg text-xs font-bold ${
                resolvedTheme === "light" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-border"
              }`}
              onClick={() => setTheme("light")}
            >
              <Sun className="size-3.5" /> Light
            </Button>
            <Button
              size="sm"
              variant={resolvedTheme === "dark" ? "default" : "outline"}
              className={`gap-1.5 rounded-lg text-xs font-bold ${
                resolvedTheme === "dark" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-border"
              }`}
              onClick={() => setTheme("dark")}
            >
              <Moon className="size-3.5" /> Dark
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
