"use client";

/**
 * Micro-animations for agent state (typing, thinking, idle breathing).
 *
 * cubicle_spec.md names `lottie-react` + exported After Effects JSON files
 * for these. We use small CSS/Framer Motion animations instead: there's no
 * real Lottie asset to export without a design tool, and sourcing
 * third-party Lottie files carries licensing uncertainty for no visual
 * benefit over a hand-rolled dot/spinner/pulse here. Swap in true Lottie
 * players later if real animated character assets get designed.
 */

import { motion } from "framer-motion";

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2" aria-label="typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function ThinkingSpinner({ className = "" }: { className?: string }) {
  return (
    <motion.span
      className={`inline-block size-3 rounded-full border-2 border-muted-foreground border-t-transparent ${className}`}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      aria-label="thinking"
    />
  );
}

export function IdlePulse({ className = "" }: { className?: string }) {
  return (
    <motion.span
      className={`inline-block size-2 rounded-full bg-emerald-500 ${className}`}
      animate={{ opacity: [1, 0.4, 1] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      aria-label="idle"
    />
  );
}
