/// <reference types="vite/client" />

/** Set to true by vite.participant.config.ts for the participant edition. */
declare const __SELF_RUN__: boolean | undefined;

interface Window {
  /** Where the participant edition tells people to send their results, injected by the build. */
  __WC_SEND_TO__?: string;
  /** Who runs the study and how long results are kept, injected by the build for the privacy notice. */
  __WC_NOTICE__?: { sendTo?: string; controller?: string; retention?: string };
  /** The prototype document, embedded by scripts/build-single.mjs. Absent in dev, where the frame loads /proto.html instead. */
  __PROTO_HTML__?: string;
}
