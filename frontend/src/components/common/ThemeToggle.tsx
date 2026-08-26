"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Standard next-themes SSR-hydration guard: the server can't know the
    // user's stored theme preference, so this deliberately renders a
    // neutral placeholder until after hydration, then flips once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`rounded-lg border border-border bg-card/60 opacity-50 ${className}`}
        aria-label="Toggle theme"
      >
        <Sun className="size-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`rounded-lg border border-border bg-card/75 text-foreground hover:bg-accent hover:text-accent-foreground transition-all ${className}`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-primary" />}
    </Button>
  );
}
