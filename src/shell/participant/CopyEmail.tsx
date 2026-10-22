import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "../brand.tsx";

/**
 * An email address with a small Copy button beside it. Where the browser blocks clipboard access, the address is selected
 * instead and the participant is told to press the copy keys.
 */
export function CopyEmail({ address }: { address: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const text = useRef<HTMLElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(address);
      setState("copied");
    } catch {
      const range = document.createRange();
      if (text.current) range.selectNodeContents(text.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      setState("manual");
    }
    timer.current = window.setTimeout(() => setState("idle"), 5000);
  };
  return (
    <>
      <strong ref={text}>{address}</strong>{" "}
      <button type="button" className="p-copy" onClick={() => void copy()} aria-label="Copy email address">
        {state === "copied" ? <CheckIcon /> : <CopyIcon />}
        {state === "copied" ? "Copied" : "Copy"}
      </button>
      <span role="status" className={state === "manual" ? "p-copy-note" : "sr-only"}>
        {state === "copied" ? "Email address copied." : state === "manual" ? "Selected. Press Ctrl+C (Cmd+C on a Mac) to copy it." : ""}
      </span>
    </>
  );
}
