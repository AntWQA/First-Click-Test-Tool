import { useEffect, useMemo, useRef, useState } from "react";
import { BREAKPOINTS, SHELL_SOURCE, parseProtoEnvelope } from "../shared/protocol.ts";
import type { Breakpoint, ProtoMessage, ShellEnvelope } from "../shared/protocol.ts";

interface Props {
  breakpoint: Breakpoint;
  /** Bump to send the prototype back to its start state (a remount inside the frame, not a reload of the document). */
  resetKey: number;
  onMessage: (msg: ProtoMessage) => void;
  /** Called when the scale at which the frame is shown changes (1 means true size). */
  onScale?: (scale: number) => void;
}

const newNonce = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

/** Scale to fit, floored to two decimals: a fractional scale blurs text, and a floor never overflows the space. */
export const fitScale = (availW: number, availH: number, spec: { width: number; height: number }): number =>
  Math.max(0.1, Math.floor(Math.min(1, availW / spec.width, availH / spec.height) * 100) / 100);

/**
 * The prototype in a sandboxed iframe at one of the three breakpoints. The sandbox has no same-origin access, so the
 * prototype is isolated from this page and talks to it only through postMessage. The frame is a fixed viewport (width
 * and height from the Figma frames), scaled down with a transform when the window is too small; the layout inside
 * stays at the true breakpoint, and pointer positions inside it stay in true-breakpoint coordinates.
 */
export function Frame({ breakpoint, resetKey, onMessage, onScale }: Props) {
  const spec = BREAKPOINTS[breakpoint];
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const nonce = useMemo(newNonce, []);
  const [scale, setScale] = useState(1);
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    const el = stage.current;
    if (!el) return undefined;
    const measure = () => setScale(fitScale(el.clientWidth, el.clientHeight, spec));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [spec.width, spec.height]);

  useEffect(() => { onScale?.(scale); }, [scale, onScale]);

  useEffect(() => {
    const listen = (e: MessageEvent) => {
      // Re-read contentWindow every time: it is a new object after the frame reloads.
      if (e.source !== frame.current?.contentWindow) return;
      const msg = parseProtoEnvelope(e.data, nonce);
      if (msg) handler.current(msg);
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [nonce]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const env: ShellEnvelope = { source: SHELL_SOURCE, nonce, type: "reset" };
    frame.current?.contentWindow?.postMessage(env, "*"); // the frame's origin is opaque, so no narrower target exists
  }, [resetKey, nonce]);

  const embedded = window.__PROTO_HTML__;
  const srcDoc = useMemo(
    () => (embedded ? embedded.replace("<!--wc-nonce-->", `<script>window.__WC_NONCE__=${JSON.stringify(nonce)};</script>`) : undefined),
    [embedded, nonce],
  );

  return (
    <div className="frame-stage" ref={stage}>
      <div className="frame-box" style={{ width: spec.width * scale, height: spec.height * scale }} data-breakpoint={breakpoint} data-scale={scale}>
        <iframe
          ref={frame}
          title="Website navigation"
          sandbox="allow-scripts"
          {...(srcDoc ? { srcDoc } : { src: `/proto.html?nonce=${encodeURIComponent(nonce)}` })}
          style={{ width: spec.width, height: spec.height, transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}
