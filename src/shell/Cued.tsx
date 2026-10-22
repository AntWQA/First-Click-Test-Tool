import { Fragment } from "react";

/** Phrases that tell the participant what to do before they touch the page. Longer phrase first, so "or click" is kept with it. */
const CUE = /(Before you scroll or click|Before you scroll)/g;

/** Renders task wording with the opening cue (Before you scroll, Before you scroll or click) in bold and the cue colour. */
export function Cued({ text }: { text: string }) {
  return <>{text.split(CUE).map((part, i) => (i % 2 === 1 ? <strong key={i} className="cue">{part}</strong> : <Fragment key={i}>{part}</Fragment>))}</>;
}
