"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import type { SpeechBubbleState } from "@/hooks/useSpeechBubbles";

export function SpeechBubbleOverlay({ bubbles }: { bubbles: SpeechBubbleState[] }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-12 z-10 flex flex-col items-center gap-2">
      <AnimatePresence>
        {bubbles.map((bubble) => (
          <motion.div
            key={bubble.id}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8, scale: reduceMotion ? 1 : 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8, scale: reduceMotion ? 1 : 0.9 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-[#101827]/82 px-3.5 py-2 text-2xs text-white shadow-xl backdrop-blur-xl"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: bubble.accentColor }}
            />
            <span className="font-medium">{bubble.agentName}</span>
            <span className="text-white/65">{bubble.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
