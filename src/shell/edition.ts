/**
 * Which build this is. The participant edition (scripts/build-single.mjs participant) is set up and run by the participant
 * alone: no moderator screens, no header options, no hand-back. The define comes from vite.participant.config.ts; the
 * moderator build leaves it undefined.
 */
export const SELF_RUN: boolean = typeof __SELF_RUN__ !== "undefined" && __SELF_RUN__;

/** Where the participant is asked to send their results file (set when the file is built), or empty. */
export const SEND_TO: string = (typeof window !== "undefined" && window.__WC_SEND_TO__) || "";

/** Who runs the study and how long results are kept, shown in the privacy notice. Set when the file is built. */
export const NOTICE = {
  controller: (typeof window !== "undefined" && window.__WC_NOTICE__?.controller) || "",
  retention: (typeof window !== "undefined" && window.__WC_NOTICE__?.retention) || "",
};
