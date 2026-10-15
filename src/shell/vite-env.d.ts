/// <reference types="vite/client" />

interface Window {
  /** The prototype document, embedded by scripts/build-single.mjs. Absent in dev, where the frame loads /proto.html instead. */
  __PROTO_HTML__?: string;
}
