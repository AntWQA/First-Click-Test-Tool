/**
 * Which build this is. The participant edition (scripts/build-single.mjs participant) is set up and run by the participant
 * alone: no moderator screens, no header options, no hand-back. The define comes from vite.participant.config.ts; the
 * moderator build leaves it undefined.
 */
export const SELF_RUN: boolean = typeof __SELF_RUN__ !== "undefined" && __SELF_RUN__;

/** Where the participant is asked to send their results file, and to ask to see or delete them. Fixed: it does not change between builds. */
export const SEND_TO = "usability@doterra.com";

/** Who runs the study and how long results are kept, shown in the privacy notice. Fixed: it does not change between builds. */
export const NOTICE = {
  controller: "doTERRA International, LLC",
  retention: "12 months",
} as const;
