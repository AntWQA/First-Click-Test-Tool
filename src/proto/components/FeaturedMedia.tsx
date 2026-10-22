import { useEffect, useRef } from "react";
import { Video, useMediaQuery } from "@doterra-it/design-system-ui-base";
import poster from "./media/featured-poster.webp";
import eoMegaVideo from "./media/featured.mp4";
import "./featured-media.css";


/**
 * Landscape video for a menu's featured tile. The clip is the EO Mega+ reveal (3840x2160 HEVC, 31 s, supplied 19 Oct 2026),
 * re-encoded to 640x360 H.264 at 300 kbps so it fits the single-file build. Behaves like background footage: muted,
 * looping, no controls, hidden from assistive technology, and paused (poster only) when the visitor asks for reduced motion.
 * It must not carry a data-testid: the recorder reads the nearest one to classify a click, and it has to find the tile link's. Keyed by the tile's link so another featured tile never picks it up by accident.
 */
const MEDIA: Record<string, string> = { "/shop/eo-mega-plus": eoMegaVideo };

export function FeaturedMedia({ href }: { href: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const src = MEDIA[href];

  // Browsers pause muted autoplay video that is hidden and do not restart it, so a desktop menu's clip is started when
  // Pure opens the panel and rewound when it closes. Outside a panel (the mobile drawer) it simply plays.
  useEffect(() => {
    const video = videoRef.current;
    const panel = boxRef.current?.closest(".dtds-nav__sub-menu");
    if (!video) return;
    const sync = () => {
      const open = !panel || (panel.classList.contains("dtds-nav__sub-menu--is-open") && panel.getAttribute("aria-hidden") !== "true");
      if (open && !reducedMotion) void video.play().catch(() => undefined);
      else { video.pause(); if (!open) video.currentTime = 0; }
    };
    sync();
    if (!panel) return;
    const observer = new MutationObserver(sync);
    observer.observe(panel, { attributes: true, attributeFilter: ["class", "aria-hidden"] });
    return () => observer.disconnect();
  }, [reducedMotion, src]);

  if (!src) return null;
  return (
    <div ref={boxRef} className="hp-featured-media" aria-hidden="true">
      <Video src={src} videoRef={videoRef} playing={!reducedMotion} muted showInitialPlayButton={false} loop playsInline poster={poster} />
    </div>
  );
}
