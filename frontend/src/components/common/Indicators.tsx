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

import { motion, useReducedMotion } from "framer-motion";

// These loop forever (bounce/spin/pulse) to signal live agent state — exactly
// the kind of motion prefers-reduced-motion users ask to avoid. The global
// CSS transition/animation override in globals.css doesn't reach Framer
// Motion's own transform engine, so each one checks the preference directly
// and swaps to a static equivalent that still conveys the same state.

export function TypingIndicator() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex items-center gap-1 px-1 py-2" aria-label="typing">
      {[0, 1, 2].map((i) =>
        reduceMotion ? (
          <span key={i} className="size-1.5 rounded-full bg-muted-foreground" />
        ) : (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-muted-foreground"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        )
      )}
    </div>
  );
}

export function ThinkingSpinner({ className = "" }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return (
      <span
        className={`inline-block size-3 rounded-full border-2 border-muted-foreground border-t-transparent ${className}`}
        aria-label="thinking"
      />
    );
  }
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
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <span className={`inline-block size-2 rounded-full bg-emerald-500 ${className}`} aria-label="idle" />;
  }
  return (
    <motion.span
      className={`inline-block size-2 rounded-full bg-emerald-500 ${className}`}
      animate={{ opacity: [1, 0.4, 1] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      aria-label="idle"
    />
  );
}
