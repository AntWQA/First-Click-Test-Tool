import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Accordion, Box, Button, Container, Flex, Grid, Icon, IconButton, Main, Modal, Radio, RadioGroup, Rating, Section, Stack, Text, utilClassNames,
} from "@doterra-it/design-system-ui-base";
import { Gallery, ProductCardSimple, QuantityField, ReviewCard, UsageIcons } from "@doterra-it/design-system-ui-ecommerce";
import Carousel from "@doterra-it/design-system-ui-carousel";
import { PageBreadcrumbs } from "../../components/PageBreadcrumbs";
import type { Crumb } from "../../components/PageBreadcrumbs";
import { slugify } from "../../search/format";
import { BasicSection } from "../home/blocks";
import { productCategoryCrumbs, StubPage } from "../StubPage";
import { productImage, productMeta } from "../../search/productView";
import { buildPdp } from "./content";
import type { Pdp } from "./content";
import "./pdp.css";

/**
 * Product detail page, signed-out retail state (Figma: Product Detail Page, "Retail customer not logged in", desktop
 * and mobile). Built from the installed Pure 2.6.0 components: Gallery, PromoTag, Rating, QuantityField, UsageIcons,
 * Accordion, Modal, ReviewCard, ProductCardSimple and the carousel. Where Pure has no component the page uses the
 * pdp- rules in pdp.css (badges, purchase card, shipping line, CPTG mark; PromoTag renders as plain coloured text, so it is not used). Add to bag does nothing beyond a short confirmation:
 * there is no bag in the prototype.
 */

/** One place for the button wording. The design says "Add item to cart"; the homepage team says "Add to bag". */
const ADD_LABEL = "Add item to cart";
const money = (n: number) => `$${n.toFixed(2)}`;
const RELATED = { slidesPerPage: { xs: 1, sm: 2, md: 3, lg: 4 }, slideGap: "md", peekNext: true } as const;

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
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="pdp-ship__icon">
    <path d="M14 17V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v11h2m10 0H9m5 0h1m0-9h3.6a1 1 0 0 1 .8.4l2.4 3.2a1 1 0 0 1 .2.6V17h-2M15 17h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="7" cy="17.5" r="2" stroke="currentColor" strokeWidth="1.6" /><circle cx="18" cy="17.5" r="2" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

/** CPTG Certified Pure Tested Grade mark, drawn in CSS because the design's vector is not part of the prototype assets. */
const Cptg = () => (
  <div className="pdp-cptg" data-testid="pdp-cptg">
    <span className="pdp-cptg__seal" aria-hidden="true"><b>CP</b>TG</span>
    <span className="pdp-cptg__text">Certified Pure Tested Grade</span>
  </div>
);

const jump = (id: string) => (e: React.MouseEvent) => {
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
};

function ShippingOptions({ open, setOpen }: { open: boolean; setOpen: Dispatch<SetStateAction<boolean>> }) {
  return (
    <Modal state={[open, setOpen]} width="large">
      <Modal.Title>Shipping options</Modal.Title>
      <Modal.Body>
        <Stack spacing="lg" data-testid="pdp-shipping-overlay">
          <Text size="textSm" color="text-subtle">Delivery times are estimates. They are counted in business days, starting from when your order ships.</Text>
          <table className="pdp-table">
            <thead><tr><th scope="col">Method</th><th scope="col">Shipping cost</th><th scope="col">Transit time</th></tr></thead>
            <tbody>
              {SHIPPING.map((r, i) => (
                <tr key={i}>
                  <th scope="row"><span>{r.method}</span>{r.note && <small>{r.note}</small>}</th>
                  <td>{r.cost}</td>
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

function BuyBox({ pdp }: { pdp: Pdp }) {
  const [option, setOption] = useState<"one-time" | "account">("one-time");
  const [qty, setQty] = useState<number | "">(1);
  const [added, setAdded] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const account = option === "account";
  const units = qty === "" ? 1 : qty;
  const retail = pdp.retail * units;
  const price = (account ? pdp.account : pdp.retail) * units;
  const add = () => {
    setAdded(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded(false), 2000);
  };

  return (
    <Stack spacing="lg">
      <div className="pdp-buy" data-testid="pdp-buy-box">
        <RadioGroup value={option} onValueChange={(v) => setOption(v as "one-time" | "account")} name="purchase-option">
          <div className="pdp-option" data-testid="pdp-option-one-time">
            <Radio id="pdp-opt-one-time" value="one-time" optionalText="" label={<span className="pdp-option__label pdp-option__label--strong">One time purchase</span>} />
          </div>
          <div className="pdp-option" data-testid="pdp-option-account">
            <Radio id="pdp-opt-account" value="account" optionalText="" label={<span className="pdp-option__label">Create an account and <b className="pdp-save">save 25%</b> <b>on products</b></span>} />
          </div>
        </RadioGroup>
        <div className="pdp-buy__panel">
          <div data-testid="pdp-quantity"><QuantityField size="small" defaultValue={1} inputId="pdp-qty" onChange={setQty} /></div>
          <div className="pdp-price" data-testid="pdp-price" aria-live="polite">
            <Text size="textLg" weight="semiBold">{account ? "Your membership price" : "One time price"}</Text>
            <div className="pdp-price__row">
              {account && <s className="pdp-price__was">{money(retail)}</s>}
              <span className="pdp-price__now">{money(price)}</span>
            </div>
          </div>
          <Button variant="primary" size="xlarge" className="pdp-add" onClick={add} data-testid="pdp-add-to-cart">{added ? "Added" : ADD_LABEL}</Button>
        </div>
      </div>

      <div className="pdp-ship" data-testid="pdp-shipping">
        <Truck />
        <div>
          <Text size="textSm">FREE Shipping on Loyalty orders of 100 PV+</Text>
          <button type="button" className="pdp-linkbutton" onClick={() => setShipOpen(true)} data-testid="pdp-shipping-link">Shipping &amp; Returns Information</button>
        </div>
      </div>
      <ShippingOptions open={shipOpen} setOpen={setShipOpen} />
    </Stack>
  );
}

function Details({ pdp }: { pdp: Pdp }) {
  const plus = <Icon name="plus" size="md" />;
  const minus = <Icon name="minus" size="md" />;
  return (
    <div className="pdp-accordion">
      <Accordion variant="ghost" defaultExpanded="things">
        <Accordion.Item id="things" size="lg" title="Things to know" openIndicator={plus} closeIndicator={minus} data-testid="pdp-things-to-know">
          <Stack spacing="md">
            <ul className="pdp-list">{pdp.things.map((t) => <li key={t}><Text as="span" size="textMd">{t}</Text></li>)}</ul>
            <Stack spacing="xs">
              <Text size="textMd">Cautions</Text>
              <Text size="textMd" color="text-secondary">{pdp.cautions}</Text>
            </Stack>
            {pdp.usage.length > 0 && (
              <Stack spacing="sm" data-testid="pdp-usage-icons">
                <Text size="textSm" weight="semiBold">Can be used</Text>
                <UsageIcons icons={pdp.usage} />
              </Stack>
            )}
          </Stack>
        </Accordion.Item>
        <Accordion.Item id="description" size="lg" title="Product description" openIndicator={plus} closeIndicator={minus} data-testid="pdp-product-description">
          <Stack spacing="md">{pdp.description.map((p) => <Text key={p} size="textMd" color="text-secondary">{p}</Text>)}</Stack>
        </Accordion.Item>
        <Accordion.Item id="how-to-use" size="lg" title="How to use" openIndicator={plus} closeIndicator={minus} data-testid="pdp-how-to-use">
          <ul className="pdp-list">{pdp.howTo.map((t) => <li key={t}><Text as="span" size="textMd">{t}</Text></li>)}</ul>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}

function Band({ id, tint, children }: { id: string; tint?: boolean; children: ReactNode }) {
  return (
    <Box backgroundColor={tint ? "extra-light" : undefined} id={id}>
      <Section size="lg"><Container width="wide">{children}</Container></Section>
    </Box>
  );
}

function ProductPageView({ pdp }: { pdp: Pdp }) {
  const navigate = useNavigate();
  const crumbs: Crumb[] = [
    { label: "Home", to: "/" },
    { label: "Shop", to: "/shop" },
    ...productCategoryCrumbs(pdp.product),
    { label: pdp.name, to: `/shop/products/${pdp.slug}` },
  ];
  return (
    <Main isFlush>
      <Section size="xs">
        <Container width="wide" className={utilClassNames("lg:pt-8")}>
          <Stack spacing="lg" className={utilClassNames("pt-12", "pb-12")}>
            <PageBreadcrumbs crumbs={crumbs} />
            <Grid gap="xl">
              <Grid.Column span={{ xs: 12, lg: 7 }}>
                <div className="pdp-gallery" data-testid="pdp-gallery"><Gallery images={pdp.images} thumbnailPosition="bottom" /></div>
              </Grid.Column>
              <Grid.Column span={{ xs: 12, lg: 5 }}>
                <Stack spacing="lg">
                  <Stack spacing="md">
                    <Flex spacing="xs" data-testid="pdp-badges">
                      {pdp.bestSeller && <span className="pdp-badge pdp-badge--solid">Best seller</span>}
                      <span className="pdp-badge">25% off</span>
                    </Flex>
                    <Text as="h1" size={{ xs: "displaySm", md: "displayMd" }} weight="semiBold" data-testid="pdp-title">{pdp.name}</Text>
                    <Flex align="center" spacing="sm" wrap data-testid="pdp-rating">
                      <Rating id="pdp-rating" label="Average rating" labelHidden readOnly value={pdp.rating} size="sm" />
                      <Text size="textSm"><b>{pdp.rating.toFixed(1)}</b> ({pdp.reviewCount} reviews)</Text>
                      {pdp.soldThisWeek && <Text size="textSm" weight="semiBold" color="text-subtle">100+ sold this week</Text>}
                    </Flex>
                    <Text size="textMd" data-testid="pdp-blurb">{pdp.blurb} <a className="pdp-readmore" href="#description" onClick={jump("pdp-details")} data-testid="pdp-readmore">Read more</a></Text>
                    <Text size="textMd">Size: {pdp.size} - Item: {pdp.sku}. <a className="pdp-readmore" href="#description" onClick={jump("pdp-details")}>Read more</a></Text>
                  </Stack>
                  <BuyBox pdp={pdp} />
                  <Cptg />
                  <Flex spacing="sm">
                    <span data-testid="pdp-download"><IconButton icon="file-download-01" accessibilityLabel="Download the Safety Data Sheet" className="pdp-iconbutton" /></span>
                    <span data-testid="pdp-share"><IconButton icon="share-07" accessibilityLabel="Share this product" className="pdp-iconbutton" /></span>
                  </Flex>
                  <div id="pdp-details"><Details pdp={pdp} /></div>
                </Stack>
              </Grid.Column>
            </Grid>
          </Stack>
        </Container>
      </Section>

      <Band id="reviews" tint>
        <Stack spacing="xl" data-testid="pdp-reviews">
          <BasicSection eyebrow="Reviews" headline="What our customers are saying" />
          <Grid gap="lg">
            {pdp.reviews.map((r) => (
              <Grid.Column key={r.name} span={{ xs: 12, sm: 6, lg: 3 }}>
                <ReviewCard starValue={r.stars} bodyText={r.body} name={r.name} title={r.title} />
              </Grid.Column>
            ))}
          </Grid>
        </Stack>
      </Band>

      <Band id="faq">
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

      <Band id="recommended" tint>
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
