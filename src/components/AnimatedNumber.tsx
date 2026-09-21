import { useEffect, useRef, useState } from "react";

export interface AnimatedNumberProps {
  /** Already-formatted display text (e.g. "48,309,785", "12.83", "—"). */
  text: string;
  /** Wait this long before the scramble starts — used to stagger a row/grid of numbers. */
  delay?: number;
  /** How long the scramble runs before settling on the real value. */
  duration?: number;
  className?: string;
}

const DIGITS = "0123456789";
const HAS_DIGIT = /\d/;

function isReducedMotion(): boolean {
  // jsdom (unit/integration tests) doesn't implement matchMedia — treat that
  // the same as "no preference" rather than throwing.
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Scrambles only the digit characters, leaving punctuation (commas, decimal
// points, minus signs, "—" placeholders) untouched, and progressively locks
// digits in left-to-right as the animation nears completion — reads as a
// settling slot-machine reveal rather than a flat cut from noise to value.
function scrambleFrame(text: string, progress: number): string {
  const length = text.length;
  return text
    .split("")
    .map((ch, i) => {
      if (!/\d/.test(ch)) return ch;
      const lockAt = 0.55 + (i / Math.max(length - 1, 1)) * 0.4;
      if (progress >= lockAt) return ch;
      return DIGITS[Math.floor(Math.random() * DIGITS.length)];
    })
    .join("");
}

export function AnimatedNumber({ text, delay = 0, duration = 1600, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(text);
  const skipRef = useRef(false);

  useEffect(() => {
    skipRef.current = isReducedMotion();
  }, []);

  useEffect(() => {
    if (!HAS_DIGIT.test(text) || skipRef.current) {
      setDisplay(text);
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let startTime: number | null = null;

    function step(timestamp: number) {
      if (cancelled) return;
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setDisplay(scrambleFrame(text, progress));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setDisplay(text);
      }
    }

    const timeoutId = setTimeout(() => {
      rafId = requestAnimationFrame(step);
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [text, delay, duration]);

  return (
    <span className={`animated-number${className ? ` ${className}` : ""}`} aria-label={text}>
      {display}
    </span>
  );
}
