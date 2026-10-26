import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Accordion, Box, Container, Flex, Grid, Icon, IconButton, Main, Modal, Rating, Section, Stack, Text, utilClassNames,
} from "@doterra-it/design-system-ui-base";
import { ProductCardSimple, ReviewCard, UsageIcons } from "@doterra-it/design-system-ui-ecommerce";
import Carousel from "@doterra-it/design-system-ui-carousel";
import { PageBreadcrumbs } from "../../components/PageBreadcrumbs";
import type { Crumb } from "../../components/PageBreadcrumbs";
import { slugify } from "../../search/format";
import { BasicSection } from "../home/blocks";
import { productCategoryCrumbs, StubPage } from "../StubPage";
import { productImage, productMeta } from "../../search/productView";
import { buildPdp } from "./content";
import type { Pdp, PdpImage } from "./content";
import { pdpImages } from "./images";
import "./pdp.css";

/**
 * Product detail page, signed-out retail state, from the updated PDP design ("updated PDP/pdp.html", the version without the
 * member overlay). The purchase card, price tooltips, gallery, accordions and mini cart follow that design; the reviews,
 * FAQ and recommended products below them are built from the installed Pure 2.6.0 components (ReviewCard, Accordion,
 * ProductCardSimple and the carousel). Add item to cart opens the design's mini cart; there is no bag page, so View Your
 * Cart leads to a plain page.
 */

/** One place for the button wording. The design says "Add item to cart"; the homepage team says "Add to bag". */
const ADD_LABEL = "Add item to cart";
const money = (n: number) => `$${n.toFixed(2)}`;
const RELATED = { slidesPerPage: { xs: 1, sm: 2, md: 3, lg: 4 }, slideGap: "md", peekNext: true } as const;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Restart a CSS animation class on an element. */
const retrigger = (el: HTMLElement | null, cls: string) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

/** Delivery options, from the "How shipping will work" overlay in the design. */
const SHIPPING: Array<{ method: string; note?: string; cost: string; time: string }> = [
  { method: "Economy", note: "Loyalty or enrollment orders of 100 PV or more", cost: "Free", time: "3–8 business days" },
  { method: "Economy", note: "Loyalty orders of 50 PV or more", cost: "$3.99", time: "3–8 business days" },
  { method: "Economy", cost: "$6.99", time: "3–8 business days" },
  { method: "Standard", cost: "$9.99", time: "2–6 business days" },
  { method: "Priority", cost: "$14.99", time: "2 business days" },
  { method: "Express", cost: "$24.99", time: "Next business day" },
];

const Truck = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="pdp-ship__icon">
    <path d="M2 6h12v10H2zM14 9h4l3 3v4h-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="17.5" r="1.8" stroke="currentColor" strokeWidth="1.5" /><circle cx="17" cy="17.5" r="1.8" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const Svg = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const InfoIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10.67V8m0-2.67h.01M14.67 8A6.67 6.67 0 1 1 1.33 8a6.67 6.67 0 0 1 13.34 0Z" /></svg>
);

function ShippingOptions({ open, setOpen }: { open: boolean; setOpen: Dispatch<SetStateAction<boolean>> }) {
  return (
    <Modal state={[open, setOpen]} width="large">
      <Modal.Title>Shipping options</Modal.Title>
      <Modal.Body>
        <Stack spacing="lg" data-testid="pdp-shipping-overlay" data-zone="shipping">
          <Text size="textSm" color="text-subtle">Delivery times are estimates. They are counted in business days, starting from when your order ships.</Text>
          <table className="pdp-table">
            <thead><tr><th scope="col">Method</th><th scope="col">Shipping cost</th><th scope="col">Transit time</th></tr></thead>
            <tbody>
              {SHIPPING.map((r, i) => (
                <tr key={i}>
                  <th scope="row"><span>{r.method}</span>{r.note && <small>{r.note}</small>}</th>
                  <td className={r.cost === "Free" ? "pdp-table__free" : undefined}>{r.cost}</td>
                  <td>{r.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Stack spacing="sm">
            <Text size="textSm" weight="semiBold">Hawaii, Alaska, Puerto Rico, Guam and APO/FPO/DPO</Text>
            <ul className="pdp-list pdp-list--small">
              <li>Economy to Hawaii and Alaska: $7.99</li>
              <li>Economy to Puerto Rico, Guam and APO/FPO/DPO: $6.99</li>
              <li>Loyalty or enrollment orders of 100 PV or more ship free (economy) to Hawaii, Puerto Rico, Guam and APO/FPO/DPO</li>
            </ul>
          </Stack>
        </Stack>
      </Modal.Body>
    </Modal>
  );
}

type Mode = "one-time" | "account";
const TIPS: Record<Mode, { title: string; body: string; action?: string }> = {
  account: { title: "Membership pricing", body: "Create an account and save 25% on all future orders." },
  "one-time": {
    title: "Did you know?",
    body: "You can save 25% on all products. Simply select the option below, then create an account at checkout.",
    action: "Show me the membership price",
  },
};

/** The price counts to its new value, as in the design. No animation when the visitor prefers reduced motion. */
function useTween(target: number): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduced()) { from.current = target; setShown(target); return; }
    const start = performance.now(), begin = from.current;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 650);
      const v = begin + (target - begin) * (1 - Math.pow(1 - t, 4));
      from.current = v; setShown(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

function MiniCart({ open, onClose, pdp, mode, count }: { open: boolean; onClose: () => void; pdp: Pdp; mode: Mode; count: number }) {
  const navigate = useNavigate();
  const [top, setTop] = useState(0);
  const member = mode === "account";
  const total = (member ? pdp.account : pdp.retail) * count;
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => setTop(Math.max(0, document.querySelector("header")?.getBoundingClientRect().bottom ?? 0));
    place();
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place); window.removeEventListener("resize", place); };
  }, [open]);
  return (
    <div className={`pdp-mini${open ? " is-open" : ""}`} style={{ top }} role="dialog" aria-label="Added to cart" aria-hidden={!open} data-testid="pdp-mini-cart" data-zone="mini-cart">
      <div className="pdp-mini__added"><Svg d="M20 6 9 17l-5-5" size={18} />Added to cart
        <button type="button" className="pdp-mini__close" aria-label="Close" onClick={onClose} tabIndex={open ? 0 : -1}><Svg d="M6 6l12 12M18 6 6 18" /></button>
      </div>
      <div className="pdp-mini__head"><span>{count} {count === 1 ? "Item" : "Items"}</span><span>{money(total)}</span></div>
      <div className="pdp-mini__item">
        <div className="pdp-mini__thumb"><img alt="" src={pdp.images[0]?.src} /></div>
        <div className="pdp-mini__info">
          <b>{pdp.name}</b><small>{pdp.size}</small>
          <div className="pdp-mini__row"><span>{money(total)}</span><span className="pdp-mini__qty">Qty: {count}</span></div>
          {member && <span className="pdp-mini__tag">Membership price · save 25%</span>}
        </div>
      </div>
      <div className="pdp-mini__foot"><button type="button" className="pdp-mini__view" onClick={() => navigate("/cart")} tabIndex={open ? 0 : -1} data-testid="pdp-view-cart">View Your Cart</button></div>
    </div>
  );
}

function BuyBox({ pdp }: { pdp: Pdp }) {
  const [mode, setMode] = useState<Mode>("one-time");
  const [qty, setQty] = useState(1);
  const [shipOpen, setShipOpen] = useState(false);
  const [bag, setBag] = useState(0);
  const [miniOpen, setMiniOpen] = useState(false);
  const [tip, setTip] = useState<Mode | null>(null);
  const [tipPos, setTipPos] = useState({ left: 0, top: 0, ax: 0, below: false });
  const member = mode === "account";

  const optionRefs = useRef<Record<Mode, HTMLDivElement | null>>({ "one-time": null, account: null });
  const indicator = useRef<HTMLDivElement>(null);
  const [indicatorReady, setIndicatorReady] = useState(false);
  const infoRefs = useRef<Record<Mode, HTMLButtonElement | null>>({ "one-time": null, account: null });
  const tipEl = useRef<HTMLDivElement>(null);
  const cta = useRef<HTMLButtonElement>(null);
  const nowEl = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<number>();
  const miniTimer = useRef<number>();
  const openedAt = useRef(0);
  const first = useRef(true);
  const accountRadio = useRef<HTMLInputElement>(null);

  const unit = member ? pdp.account : pdp.retail;
  const shown = useTween(unit * qty);

  const moveIndicator = useCallback(() => {
    const el = optionRefs.current[mode], ind = indicator.current;
    if (!el || !ind) return;
    ind.style.height = el.offsetHeight + "px";
    ind.style.transform = `translateY(${el.offsetTop}px)`;
  }, [mode]);
  useLayoutEffect(() => { moveIndicator(); }, [moveIndicator]);
  useEffect(() => {
    // The first paint places the indicator without sliding it in from the top.
    const r = requestAnimationFrame(() => setIndicatorReady(true));
    window.addEventListener("resize", moveIndicator);
    document.fonts?.ready.then(moveIndicator);
    return () => { cancelAnimationFrame(r); window.removeEventListener("resize", moveIndicator); };
  }, [moveIndicator]);

  // Choosing the other option: restart the little animations the design has on the price and the button.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    retrigger(nowEl.current, "pdp-flash");
    retrigger(cta.current, "pdp-sheen");
  }, [mode]);

  const placeTip = useCallback(() => {
    const el = tipEl.current, b = tip && infoRefs.current[tip]?.getBoundingClientRect();
    if (!el || !b) return;
    const w = el.offsetWidth, h = el.offsetHeight, gap = 10, edge = 12;
    const below = b.top - h - gap < edge;
    const cx = b.left + b.width / 2;
    const left = Math.min(Math.max(cx - w / 2, edge), window.innerWidth - w - edge);
    setTipPos({ left, top: below ? b.bottom + gap : b.top - h - gap, ax: cx - left, below });
  }, [tip]);
  useLayoutEffect(() => { placeTip(); }, [placeTip]);

  const showTip = (kind: Mode) => {
    window.clearTimeout(hideTimer.current);
    if (kind !== mode) return;
    if (tip !== kind) openedAt.current = performance.now();
    setTip(kind);
  };
  const hideTip = (now?: boolean) => {
    window.clearTimeout(hideTimer.current);
    if (now) setTip(null); else hideTimer.current = window.setTimeout(() => setTip(null), 140);
  };
  useEffect(() => {
    if (!tip) return;
    const onScroll = () => placeTip();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setTip(null); infoRefs.current[tip]?.focus(); } };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!tipEl.current?.contains(t) && !Object.values(infoRefs.current).some((b) => b?.contains(t))) setTip(null);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll);
      window.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown);
    };
  }, [tip, placeTip]);
  useEffect(() => () => { window.clearTimeout(hideTimer.current); window.clearTimeout(miniTimer.current); }, []);

  const choose = (next: Mode) => { setMode(next); setTip(null); const el = optionRefs.current[next]?.querySelector("label"); retrigger(el ?? null, "pdp-pinged"); };

  const closeMini = useCallback(() => { window.clearTimeout(miniTimer.current); setMiniOpen(false); }, []);
  const add = () => {
    setBag((b) => b + qty);
    setMiniOpen(true);
    window.clearTimeout(miniTimer.current);
    miniTimer.current = window.setTimeout(() => setMiniOpen(false), 6000);
  };
  useEffect(() => {
    if (!miniOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeMini(); };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest?.("[data-testid=pdp-mini-cart]") && !t.closest?.("[data-testid=pdp-add-to-cart]")) closeMini();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [miniOpen, closeMini]);

  const tipText = tip ? TIPS[tip] : null;
  const infoButton = (kind: Mode, label: string) => (
    <button
      type="button" className="pdp-info-btn" aria-label={label} aria-describedby="pdp-tip" aria-expanded={tip === kind} tabIndex={mode === kind ? 0 : -1}
      ref={(el) => { infoRefs.current[kind] = el; }} data-testid={`pdp-price-info-${kind}`} data-zone="price-info"
      onMouseEnter={() => showTip(kind)} onMouseLeave={() => hideTip()} onFocus={() => showTip(kind)}
      onBlur={(e) => { if (!tipEl.current?.contains(e.relatedTarget as Node)) hideTip(); }}
      onClick={(e) => {
        e.preventDefault(); // a tap fires hover and focus first, then click: do not let the click close what the tap just opened
        const justOpened = performance.now() - openedAt.current < 400;
        tip === kind && !justOpened ? hideTip(true) : showTip(kind);
      }}
    ><InfoIcon /></button>
  );

  return (
    <div className="pdp-buycol">
      <section className={`pdp-purchase${member ? " is-member" : ""}`} id="purchase" data-testid="pdp-buy-box" data-zone="buy-options">
        <div className="pdp-options" role="radiogroup" aria-label="Purchase options">
          <div ref={indicator} className="pdp-indicator" aria-hidden="true" style={indicatorReady ? undefined : { transition: "none" }} />
          <div ref={(el) => { optionRefs.current["one-time"] = el; }} data-testid="pdp-option-one-time" data-zone="option-one-time">
            <label className="pdp-option">
              <input type="radio" name="pdp-ptype" id="pdp-opt-one-time" value="one-time" checked={!member} onChange={() => choose("one-time")} autoComplete="off" />
              <span className="pdp-radio" />
              <span className="pdp-option__text">One time purchase</span>
            </label>
          </div>
          <div ref={(el) => { optionRefs.current.account = el; }} data-testid="pdp-option-account" data-zone="option-account">
            <label className="pdp-option">
              <input type="radio" name="pdp-ptype" id="pdp-opt-account" value="account" checked={member} onChange={() => choose("account")} ref={accountRadio} autoComplete="off" />
              <span className="pdp-radio" />
              <span className="pdp-option__text pdp-option__text--bold"><Svg d="M20 6 9 17l-5-5" size={16} />Create an account and <span className="pdp-save">save 25%</span> on products</span>
            </label>
          </div>
        </div>

        <div className="pdp-panel">
          <div className="pdp-stepper" data-testid="pdp-quantity" data-zone="quantity">
            <button type="button" aria-label="Decrease quantity" disabled={qty === 1} onClick={() => setQty((q) => Math.max(1, q - 1))}><Svg d="M5 12h14" /></button>
            <output aria-live="polite" aria-label={`Quantity ${qty}`}>{qty}</output>
            <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(99, q + 1))}><Svg d="M5 12h14M12 5v14" /></button>
          </div>
          <div data-testid="pdp-price" aria-live="polite">
            <div className="pdp-price-label">
              <span className="pdp-l-one" aria-hidden={member}>One time price{infoButton("one-time", "How to save 25%")}</span>
              <span className="pdp-l-member" aria-hidden={!member}>Your membership price{infoButton("account", "About membership pricing")}</span>
            </div>
            <div className="pdp-price-row">
              <span className="pdp-was" aria-hidden={!member}>{money(pdp.retail * qty)}</span>
              <span className="pdp-now" ref={nowEl}>{money(shown)}</span>
            </div>
          </div>
          <div className="pdp-save-chip" aria-hidden={!member}>
            <Svg d="M20 6 9 17l-5-5" size={13} />
            <span>you saved {money((pdp.retail - pdp.account) * qty)}</span>
          </div>
          <button type="button" ref={cta} className="pdp-cta" onClick={add} data-testid="pdp-add-to-cart" data-zone="add-to-cart">{ADD_LABEL}</button>
        </div>
      </section>

      <div className="pdp-ship" data-testid="pdp-shipping" data-zone="shipping">
        <Truck />
        <div>
          FREE Shipping on Loyalty orders of 100 PV+<br />
          <button type="button" className="pdp-linkbutton" onClick={() => setShipOpen(true)} data-testid="pdp-shipping-link">Shipping &amp; Returns Information</button>
        </div>
      </div>
      <ShippingOptions open={shipOpen} setOpen={setShipOpen} />

      <div
        id="pdp-tip" ref={tipEl} role="tooltip" aria-hidden={!tip} data-testid="pdp-price-tip" data-zone="price-info"
        className={`pdp-tip${tip ? " is-open" : ""}${tipPos.below ? " is-below" : ""}`}
        style={{ left: tipPos.left, top: tipPos.top, ["--ax" as string]: `${tipPos.ax}px` }}
        onMouseEnter={() => window.clearTimeout(hideTimer.current)} onMouseLeave={() => hideTip()}
        onBlur={(e) => { if (!tipEl.current?.contains(e.relatedTarget as Node) && e.relatedTarget !== (tip && infoRefs.current[tip])) hideTip(); }}
      >
        <strong>{tipText?.title}</strong>
        <span>{tipText?.body}</span>
        {tipText?.action && (
          <button type="button" className="pdp-tip__action" data-testid="pdp-tip-action" tabIndex={tip ? 0 : -1} onClick={() => { setTip(null); choose("account"); accountRadio.current?.focus({ preventScroll: true }); }}>
            {tipText.action}<Svg d="M5 12h14m-6-6 6 6-6 6" size={14} />
          </button>
        )}
      </div>

      <MiniCart open={miniOpen} onClose={closeMini} pdp={pdp} mode={mode} count={bag} />
    </div>
  );
}

function Gallery2({ images }: { images: PdpImage[] }) {
  const [i, setI] = useState(0);
  return (
    <div className="pdp-gallery" data-testid="pdp-gallery" data-zone="gallery">
      <div className="pdp-stage" style={{ ["--bg" as string]: `url("${images[i].src}")` }}>
        {images.map((im, j) => <img key={im.src + j} className={j === i ? "is-active" : undefined} src={im.src} alt={im.alt} loading={j === 0 ? undefined : "lazy"} />)}
      </div>
      {images.length > 1 && (
        <div className="pdp-thumbs" role="group" aria-label="Product images">
          {images.map((im, j) => (
            <button key={im.src + j} type="button" aria-current={j === i} aria-label={`Image ${j + 1}`} onClick={() => setI(j)}><img src={im.thumb ?? im.src} alt="" /></button>
          ))}
        </div>
      )}
    </div>
  );
}

function Acc({ id, title, open, setOpen, first, testid, zone, children }: { id: string; title: string; open: boolean; setOpen: (v: boolean) => void; first?: boolean; testid: string; zone: string; children: ReactNode }) {
  return (
    <div className={`pdp-acc${first ? " is-first" : ""}${open ? " is-open" : ""}`} id={id} data-testid={testid} data-zone={zone}>
      <button className="pdp-acc__head" type="button" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen(!open)}>{title}<span className="pdp-pm" aria-hidden="true" /></button>
      <div className="pdp-acc__body" id={`${id}-body`}><div><div className="pdp-acc__inner">{children}</div></div></div>
    </div>
  );
}

function Details({ pdp, openThings, setOpenThings }: { pdp: Pdp; openThings: boolean; setOpenThings: (v: boolean) => void }) {
  const [desc, setDesc] = useState(false);
  const [how, setHow] = useState(false);
  return (
    <div className="pdp-accordion">
      <Acc id="things-to-know" first title="Things to know" open={openThings} setOpen={setOpenThings} testid="pdp-things-to-know" zone="things-to-know">
        <ul className="pdp-list">{pdp.things.map((t) => <li key={t}>{t}</li>)}</ul>
        <h4>Cautions</h4>
        <p>{pdp.cautions}</p>
        {(pdp.usage.length > 0 || pdp.usageTags) && (
          <div data-testid="pdp-usage-icons" data-zone="usage-icons">
            <h5>Can be used</h5>
            {pdp.usageTags
              ? <div className="pdp-usage">{pdp.usageTags.map((u) => <span key={u.label} className={`pdp-usage__tag pdp-usage__tag--${u.tone}`}>{u.label}</span>)}</div>
              : <UsageIcons icons={pdp.usage} />}
          </div>
        )}
      </Acc>
      <Acc id="pdp-description" title="Product description" open={desc} setOpen={setDesc} testid="pdp-product-description" zone="description">
        {pdp.description.map((p) => <p key={p}>{p}</p>)}
      </Acc>
      <Acc id="pdp-how-to-use" title="How to use" open={how} setOpen={setHow} testid="pdp-how-to-use" zone="how-to-use">
        {pdp.howTo.length === 1 ? <p>{pdp.howTo[0]}</p> : <ul className="pdp-list">{pdp.howTo.map((t) => <li key={t}>{t}</li>)}</ul>}
      </Acc>
    </div>
  );
}

function Band({ id, tint, zone, children }: { id: string; tint?: boolean; zone?: string; children: ReactNode }) {
  return (
    <Box backgroundColor={tint ? "extra-light" : undefined} id={id} data-zone={zone}>
      <Section size="lg"><Container width="wide">{children}</Container></Section>
    </Box>
  );
}

function ProductPageView({ pdp }: { pdp: Pdp }) {
  const navigate = useNavigate();
  const [openThings, setOpenThings] = useState(true);
  const crumbs: Crumb[] = [
    { label: "Home", to: "/" },
    { label: "Shop", to: "/shop" },
    ...productCategoryCrumbs(pdp.product),
    { label: pdp.name, to: `/shop/products/${pdp.slug}` },
  ];

  /** Read more opens Things to know, scrolls to it and marks where the visitor has arrived. */
  const readMore = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpenThings(true);
    const el = document.getElementById("things-to-know");
    if (!el) return;
    el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
    retrigger(el, "pdp-arrived");
    el.querySelector<HTMLElement>(".pdp-acc__head")?.focus({ preventScroll: true });
  };

  return (
    <Main isFlush>
      <Section size="xs">
        <Container width="wide" className={utilClassNames("lg:pt-8")}>
          <Stack spacing="lg" className={utilClassNames("pt-12", "pb-12")}>
            <PageBreadcrumbs crumbs={crumbs} />
            <div className="pdp-grid">
              <div className="pdp-info">
                <Flex spacing="xs" data-testid="pdp-badges" data-zone="badges-title">
                  {pdp.bestSeller && <span className="pdp-badge pdp-badge--solid">Best seller</span>}
                  <span className="pdp-badge">25% off</span>
                </Flex>
                <div className="pdp-info__title">
                  <Text as="h1" size={{ xs: "displaySm", md: "displayMd" }} weight="semiBold" data-testid="pdp-title" data-zone="badges-title">{pdp.name}</Text>
                </div>
                <Flex align="center" spacing="sm" wrap data-testid="pdp-rating" data-zone="rating">
                  {pdp.reviewCount > 0 ? (
                    <>
                      <Rating id="pdp-rating" label="Average rating" labelHidden readOnly value={pdp.rating} size="sm" />
                      <Text size="textSm"><b>{pdp.rating.toFixed(1)}</b> ({pdp.reviewCount} reviews)</Text>
                    </>
                  ) : <Text size="textSm" color="text-subtle">No reviews yet</Text>}
                  {pdp.soldThisWeek && <Text size="textSm" weight="semiBold" color="text-subtle">100+ sold this week</Text>}
                </Flex>
                <p className="pdp-desc" data-testid="pdp-blurb" data-zone="description">
                  {pdp.blurb}<br />
                  <a className="pdp-readmore" href="#things-to-know" onClick={readMore} data-testid="pdp-readmore">Read more<Svg d="m6 9 6 6 6-6" size={14} /></a>
                </p>
                <div className="pdp-meta">Size: {pdp.size} · Item: {pdp.sku}</div>
              </div>

              <Gallery2 images={pdp.images} />

              <div className="pdp-buy">
                <BuyBox pdp={pdp} />
                <div className="pdp-cptg" data-testid="pdp-cptg" data-zone="cptg"><img src={pdpImages.cptg} alt="CPTG Certified Pure Tested Grade" /></div>
                <Flex spacing="sm" className="pdp-tools">
                  <span data-testid="pdp-download" data-zone="share"><IconButton icon="file-download-01" accessibilityLabel="Download product information" className="pdp-iconbutton" /></span>
                  <span data-testid="pdp-share" data-zone="share"><IconButton icon="share-07" accessibilityLabel="Share this product" className="pdp-iconbutton" /></span>
                </Flex>
                <Details pdp={pdp} openThings={openThings} setOpenThings={setOpenThings} />
              </div>
            </div>
          </Stack>
        </Container>
      </Section>

      <Band id="reviews" zone="reviews" tint>
        <Stack spacing="xl" data-testid="pdp-reviews">
          <BasicSection eyebrow="Reviews" headline="What our customers are saying" />
          {pdp.reviews.length === 0 && <Text size="textLg" color="text-secondary">There are no reviews for this product yet.</Text>}
          <Grid gap="lg">
            {pdp.reviews.map((r) => (
              <Grid.Column key={r.name} span={{ xs: 12, sm: 6, lg: 3 }}>
                <ReviewCard starValue={r.stars} bodyText={r.body} name={r.name} title={r.title} />
              </Grid.Column>
            ))}
          </Grid>
        </Stack>
      </Band>

      <Band id="faq" zone="faq">
        <Grid gap={{ xs: "lg", lg: "xxl" }} data-testid="pdp-faq">
          <Grid.Column span={{ xs: 12, lg: 4 }}><BasicSection eyebrow="Questions and answers" headline="Frequently asked questions" /></Grid.Column>
          <Grid.Column span={{ xs: 12, lg: 8 }}>
            <Accordion variant="ghost" defaultExpanded="faq-0">
              {pdp.faq.map((f, i) => (
                <Accordion.Item key={f.q} id={`faq-${i}`} size="md" icon="help-circle" title={f.q} openIndicator={<Icon name="plus" size="md" />} closeIndicator={<Icon name="minus" size="md" />}>
                  <Text size="textMd" color="text-secondary">{f.a}</Text>
                </Accordion.Item>
              ))}
            </Accordion>
          </Grid.Column>
        </Grid>
      </Band>

      <Band id="recommended" zone="recommended" tint>
        <Stack spacing="xl" data-testid="pdp-recommended">
          <BasicSection eyebrow="Recommended products" headline="Customers also purchased these items" />
          <Carousel {...RELATED} withIndicators indicatorStyle="dash" withControls controlsPosition="bottom" controlStyle="icon" controlIcon="arrow">
            {pdp.related.map((p) => (
              <Carousel.Slide key={p.id}>
                <ProductCardSimple variant="default" productImage={productImage(p)} productTitle={p.name} productMeta={productMeta(p)} price={p.retail}
                  onClick={() => navigate(`/shop/products/${slugify(p.name)}`)} data-testid={`pdp-related-${slugify(p.name)}`} />
              </Carousel.Slide>
            ))}
          </Carousel>
        </Stack>
      </Band>
    </Main>
  );
}

/** /shop/products/:slug. A slug with no product behind it falls back to the plain stub page. */
export function ProductPage() {
  const { slug = "" } = useParams();
  const pdp = useMemo(() => buildPdp(slug), [slug]);
  return pdp ? <ProductPageView key={pdp.slug} pdp={pdp} /> : <StubPage />;
}
