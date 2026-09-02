"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/** A single agent's own speech bubble — rendered inside AgentAvatar.tsx via
 * drei's <Html>, positioned above that specific character's head, comic-book
 * style (rounded cloud + a small tail pointing down at the speaker) instead
 * of the old fixed-position, screen-bottom-center overlay every agent's
 * dialogue used to funnel through regardless of where they actually were.
 * `bubbleKey` should change per new line (the bubble's own id) so
 * AnimatePresence treats a new line as a fresh enter, not a text swap. */
export function AgentSpeechBubble({ bubbleKey, text }: { bubbleKey: string; text: string }) {
  const reduceMotion = useReducedMotion();
  // Drei's centred <Html> wrapper is absolutely positioned and therefore
  // shrink-to-fit. A max-width alone lets it collapse to the min-content
  // width (often one word), which stacks dialogue into a vertical strip.
  // Collapse model-added newlines as well so the browser controls wrapping.
  const displayText = text.replace(/\s+/g, " ").trim();

  return (
    <AnimatePresence>
      <motion.div
        key={bubbleKey}
        initial={{ opacity: 0, y: reduceMotion ? 0 : 6, scale: reduceMotion ? 1 : 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.85 }}
        transition={{ duration: 0.18 }}
        className="pointer-events-none relative w-max min-w-24 max-w-[min(15rem,70vw)] rounded-2xl border-2 border-[#292724] bg-[#fffdf8] px-3 py-2 text-center shadow-[0_4px_10px_rgba(38,35,31,0.25)]"
      >
        <span className="block whitespace-normal break-words font-heading text-[10px] leading-[1.35] text-[#292724] [overflow-wrap:anywhere]">
          {displayText}
        </span>
        {/* Comic-tail: a small rotated square, clipped by its own border
            so only the bottom-left corner shows as a triangle pointing
            down at the speaker's head. */}
        <span className="absolute -bottom-[7px] left-1/2 size-3 -translate-x-1/2 rotate-45 border-r-2 border-b-2 border-[#292724] bg-[#fffdf8]" />
      </motion.div>
    </AnimatePresence>
  );
}
