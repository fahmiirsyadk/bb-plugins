import { forwardRef, useEffect, useState, type HTMLAttributes } from "react";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "framer-motion";

const circleA =
  "M 12 8 C 14.21 8 16 9.79 16 12 C 16 14.21 14.21 16 12 16 C 9.79 16 8 14.21 8 12 C 8 9.79 9.79 8 12 8 Z";

const infinity =
  "M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z";

const circleB =
  "M 12 16 C 14.21 16 16 14.21 16 12 C 16 9.79 14.21 8 12 8 C 9.79 8 8 9.79 8 12 C 8 14.21 9.79 16 12 16 Z";

const WORKING_WORDS = [
  "Working",
  "Moonwalking",
  "Dreamwalking",
  "Starwalking",
  "Skywalking",
  "Cloudwalking",
  "Nightwalking",
  "Wandering",
  "Roaming",
  "Drifting",
  "Gliding",
  "Cruising",
  "Grooving",
  "Orbiting",
  "Waltzing",
  "Shuffling",
];
const THINKING_WORDS = ["Thinking", "Thinking harder"];
const THINKING_ESCALATION_MS = 10_000;

export type ThinkingIndicatorMode = "thinking" | "working";

export interface ThinkingIndicatorProps
  extends HTMLAttributes<HTMLSpanElement> {
  /** Render the morphing glyph before the status text. */
  showIcon?: boolean;
  /** Render only the glyph, for an inline native timeline header marker. */
  iconOnly?: boolean;
  /** Announce the current status to assistive technology. */
  announce?: boolean;
  /** Thinking escalates after 10 seconds; Working cycles through the status words. */
  mode?: ThinkingIndicatorMode;
}

/** Fluid Functionalism-inspired status indicator used by the timeline bridge. */
export const ThinkingIndicator = forwardRef<
  HTMLSpanElement,
  ThinkingIndicatorProps
>(function ThinkingIndicator(
  {
    announce = true,
    className,
    iconOnly = false,
    mode = "working",
    showIcon = true,
    ...props
  },
  ref,
) {
  const reduceMotion = useReducedMotion() ?? false;
  const words = mode === "thinking" ? THINKING_WORDS : WORKING_WORDS;
  const [index, setIndex] = useState(0);
  const [thinkingEscalated, setThinkingEscalated] = useState(false);

  useEffect(() => {
    if (mode !== "working" || reduceMotion || iconOnly) return;
    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % words.length);
    }, 4_000);
    return () => window.clearInterval(interval);
  }, [iconOnly, mode, reduceMotion, words.length]);

  useEffect(() => {
    if (mode !== "thinking" || iconOnly) return;
    const timeout = window.setTimeout(
      () => setThinkingEscalated(true),
      THINKING_ESCALATION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [iconOnly, mode]);

  const visibleWord =
    mode === "thinking"
      ? thinkingEscalated
        ? THINKING_WORDS[1]
        : THINKING_WORDS[0]
      : words[reduceMotion ? 0 : index % words.length] ?? words[0];
  const accessibleLabel =
    mode === "thinking"
      ? `${thinkingEscalated ? "Thinking harder" : "Thinking"}…`
      : "Working…";

  return (
    <LazyMotion features={domAnimation}>
      <span
        ref={ref}
        role={announce ? "status" : undefined}
        aria-label={announce ? accessibleLabel : undefined}
        className={`fluid-thinking-indicator${className ? ` ${className}` : ""}`}
        {...props}
      >
        {announce ? (
          <span className="fluid-thinking-sr-only">{accessibleLabel}</span>
        ) : null}
        {showIcon ? (
          <m.svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="fluid-thinking-indicator__icon"
          >
            {reduceMotion ? (
              <path d={infinity} />
            ) : (
              <m.path
                animate={{ d: [circleA, infinity, circleB, infinity, circleA] }}
                transition={{
                  d: {
                    duration: 6,
                    ease: "easeInOut",
                    repeat: Infinity,
                    times: [0, 0.25, 0.5, 0.75, 1],
                  },
                }}
              />
            )}
          </m.svg>
        ) : null}
        <AnimatePresence mode="popLayout" initial={false}>
          {!iconOnly ? (
            <m.span
              key={visibleWord}
              className="fluid-thinking-indicator__word"
              aria-hidden="true"
              initial={reduceMotion ? false : { y: "80%", opacity: 0 }}
              animate={
                reduceMotion
                  ? {
                      y: 0,
                      opacity: 1,
                      transition: { duration: 0 },
                    }
                  : {
                      y: 0,
                      opacity: 1,
                      transition: {
                        duration: 0.24,
                        ease: [0.4, 0, 0.2, 1],
                      },
                    }
              }
              exit={
                reduceMotion
                  ? {
                      y: 0,
                      opacity: 1,
                      transition: { duration: 0 },
                    }
                  : {
                      y: "-80%",
                      opacity: 0,
                      transition: {
                        duration: 0.16,
                        ease: [0.4, 0, 0.2, 1],
                      },
                    }
              }
            >
              <span className="fluid-thinking-indicator__word-measure">
                {words.reduce(
                  (longest, word) =>
                    longest.length >= word.length ? longest : word,
                  "",
                )}
              </span>
              <span className="animate-shine fluid-thinking-indicator__word-live">
                {visibleWord}
              </span>
            </m.span>
          ) : null}
        </AnimatePresence>
      </span>
    </LazyMotion>
  );
});

ThinkingIndicator.displayName = "ThinkingIndicator";
