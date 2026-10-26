import { useEffect } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { SocialIcon, Spotlight, ProductCardSimple } from "@doterra-it/design-system-ui-ecommerce";
import {
  Accordion, Badge, Banner, Box, Button, Card, Container, Flex, Grid, Icon, Image, Link, Main, Section, Stack, Text,
  TextInput, utilClassNames,
} from "@doterra-it/design-system-ui-base";
import Carousel from "@doterra-it/design-system-ui-carousel";
import { BasicSection, CtaCard, Duplex, Hero } from "./home/blocks";
import { homeImages as img } from "./home/images";
import { findPdpProduct, pdpSlugFor } from "./pdp/content";
import { productImage, productMeta } from "../search/productView";

/**
 * Homepage body, from the design in "Prod (CF-h)". The header and footer are the prototype's own (App.tsx); nothing from
 * the design's header or footer is used. Every link is a plain anchor, as in the design: the recorder records the click
 * (as "other", which never ends a task) and no page is opened, except the three in-page jumps below.
 */

const HEADROOM = "hp-anchor";
const VARIANTS = { slidesPerPage: { xs: 1, sm: 2, md: 3, lg: 5 }, slideGap: "md", peekNext: true } as const;

/**
 * The five best sellers the homepage features. MetaPWR Advantage is first: it is the product the product page tasks use, so a participant can reach its page from here. Only the identity lives here: `pages` are the product page slugs
 * (/shop/products/:slug) to try, best match first (the dummy and live catalogues name products differently). Name, image,
 * price and size come from the catalogue record through productView, so a card always matches its product page and its
 * search result.
 */
const FEATURED = [
  { slug: "metapwr-advantage", pages: ["metapwr-advantage"] },
  { slug: "on-guard", pages: ["on-guard-protecting-blend", "d-terra-on-guard-oil-blend"] },
  { slug: "frankincense", pages: ["frankincense-essential-oil", "15ml-frankincense-essential-oil"] },
  { slug: "deep-blue-rub", pages: ["deep-blue-rub"] },
  { slug: "ylang-ylang", pages: ["ylang-ylang-essential-oil"] },
] as const;
const BEST_SELLERS = FEATURED.flatMap((f) => {
  const page = pdpSlugFor([...f.pages]);
  const product = findPdpProduct(page);
  return product ? [{ slug: f.slug, page, product }] : [];
});

interface Category { slug: string; href: string; title: string; blurb: string; image: string }
const CATEGORIES: Category[] = [
  { slug: "wellness", href: "#supplements", title: "Wellness & supplements", blurb: "Gut health, daily vitality and omegas", image: img.catWellness },
  { slug: "essential-oils", href: "#essential-oils", title: "Essential oils", blurb: "Single oils and roll-ons", image: img.catEssentialOils },
  { slug: "blends", href: "#blends", title: "Blends", blurb: "Signature blends for every routine", image: img.catBlends },
  { slug: "skin", href: "#skin", title: "Skin & personal care", blurb: "Plant-powered skin, hair and body", image: img.catSkin },
  { slug: "sport", href: "#sport", title: "Sport & recovery", blurb: "Soothing support for active days", image: img.catSport },
  { slug: "home-care", href: "#home-care", title: "Home care", blurb: "abōde™ plant-powered cleaning", image: img.catHome },
  { slug: "diffusers", href: "#diffusers", title: "Diffusers & accessories", blurb: "Diffusers, cases and gifts", image: img.catDiffusers },
];

const VALUES = [
  { image: img.valueOils, headline: "01 · Pure essential oils", href: "#essential-oils", body: "Plant-based oils and wellness products for everyday routines. ✓ Plant-based ingredients ✓ Nothing added, nothing hidden" },
  { image: img.valueSourcing, headline: "02 · Sourced at origin", href: "#sourcing", body: "Grown where plants thrive, through long-term partnerships with growers. ✓ Grower partnerships in 40+ countries ✓ Harvested where each plant grows best" },
  { image: img.valueTesting, headline: "03 · Tested for purity", href: "#quality", body: "Quality testing on every batch before it ever reaches you. ✓ Tested on every batch ✓ Verified by third-party labs" },
] as const;

const CAMPAIGNS = [
  { image: img.campaignDeepBlue, label: "Limited time", headline: "25% off Deep Blue® Stick", body: "Cool, soothing comfort after training.", cta: "Shop Deep Blue", href: "#sport", testid: "campaign-sport" },
  { image: img.campaignOnGuard, label: "New", headline: "On Guard® Foaming Hand Wash", body: "Now in a refill pack that saves plastic.", cta: "Shop On Guard", href: "#home-care", testid: "campaign-home-care" },
  { image: img.campaignAbode, label: "Member offer", headline: "The dōTERRA abōde™ Range", body: "Plant-powered cleaning for a fresh home.", cta: "Shop abōde", href: "#home-care", testid: "campaign-home-care" },
] as const;

const PLACEHOLDER = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.";
const SOCIAL = [
  { name: "Facebook", label: "Facebook" }, { name: "Instagram", label: "Instagram" }, { name: "Pinterest", label: "Pinterest" },
  { name: "Linkedin", label: "LinkedIn" }, { name: "Youtube", label: "YouTube" },
] as const;

/** Heading block above a carousel or grid: eyebrow and headline. */
const sectionHeading = (eyebrow: string, headline: ReactNode, body?: string) => <BasicSection eyebrow={eyebrow} headline={headline} body={body} />;

/** The design's three in-page jumps (Shop best sellers, How we test, All offers) scroll to their section; any other anchor stays inert. */
function useInPageJumps() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
      const target = a && a.getAttribute("href")!.length > 1 ? document.getElementById(a.getAttribute("href")!.slice(1)) : null;
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}

export function HomePage() {
  useInPageJumps();
  const navigate = useNavigate();
  return (
    <Main>
      <Banner level="brand-primary">
        <Flex align="center" spacing="xs" wrap>
          <Text as="span" size="textMd">[Live event name]: [sitewide offer], ends [date] ·</Text>
          <Link href="#offers" underline="always" data-testid="promo-banner-link">
            <Flex as="span" align="center" spacing="xs"><span>Get details</span><Icon name="arrow-right" size="sm" /></Flex>
          </Link>
        </Flex>
      </Banner>

      <Section size="xs">
        <Container width="wide">
          <Hero tagline="Plant-based wellness" title="Wellness from nature, tested beyond the label" image={img.hero}>
            <Stack spacing="lg">
              <Text size="textLg">Essential oils, supplements and personal care, made from plants grown where they thrive and tested on every batch.</Text>
              <Flex align="center" spacing="sm" wrap>
                <Button as="a" href="#best-sellers" variant="tertiary" size="xlarge" data-testid="hero-shop-best-sellers">Shop best sellers</Button>
                <Button as="a" href="#quality" variant="link-inherit" size="xlarge" data-testid="hero-how-we-test" data-zone="quality">How we test</Button>
              </Flex>
              <Flex spacing={{ xs: "lg", md: 9 }} wrap>
                {[["176", "analyses on the life of a single oil"], ["60+", "quality tests on every bottle"], ["40+", "countries we source from"]].map(([figure, label]) => (
                  <Stack key={figure} spacing={0}>
                    <Text size="displayXs" weight="semiBold">{figure}</Text>
                    <Text size="textSm">{label}</Text>
                  </Stack>
                ))}
              </Flex>
            </Stack>
          </Hero>
        </Container>
      </Section>

      <Box id="why-doterra" className={HEADROOM} data-zone="why">
        <Section size="lg">
          <Container width="wide">
            <Stack spacing="xl">
              <Stack spacing="md">
                {sectionHeading("Why dōTERRA", <span className="section-header__headline-nowrap">What we do, and why you can trust it</span>, "Every bottle starts with a plant grown in its native soil, and ends with more testing than most brands ever run.")}
                <Flex justify="start" spacing="md">
                  <Button as="a" href="#quality" variant="link-secondary" size="medium" icon="arrow-right" iconPosition="right" data-testid="section-link-quality" data-zone="quality">How we source and test</Button>
                </Flex>
              </Stack>
              <Grid gap="xl" data-zone="why-value-cards">
                {VALUES.map((v) => (
                  <Grid.Column key={v.headline} span={{ xs: 12, md: 4 }}>
                    <CtaCard image={v.image} headline={v.headline} body={v.body}
                      cta={<Button as="a" href={v.href} variant="primary" size="small" data-testid="basic-section-cta-button">Read More info</Button>} />
                  </Grid.Column>
                ))}
              </Grid>
            </Stack>
          </Container>
        </Section>
      </Box>

      <Box id="best-sellers" className={HEADROOM} data-zone="best-sellers">
        <Section size="lg">
          <Container width="wide">
            <Stack spacing="xl">
              {sectionHeading("Best Sellers", "Our most popular products")}
              <Carousel {...VARIANTS} withIndicators={false} withControls controlsPosition="bottom" controlStyle="icon" controlIcon="arrow" data-testid="best-sellers-carousel">
                {BEST_SELLERS.map((p) => (
                  <Carousel.Slide key={p.slug}>
                    <ProductCardSimple variant="default" productImage={productImage(p.product)} productTitle={p.product.name} productMeta={productMeta(p.product)} price={p.product.retail} onClick={() => navigate(`/shop/products/${p.page}`)} data-testid={`product-card-${p.slug}`} />
                  </Carousel.Slide>
                ))}
              </Carousel>
            </Stack>
          </Container>
        </Section>
      </Box>

      <Box id="shop" className={HEADROOM} data-zone="category">
        <Section size="lg">
          <Container width="wide">
            <Stack spacing="xl">
              {sectionHeading("Start exploring", "Shop by category")}
              <Carousel {...VARIANTS} withIndicators indicatorStyle="dash" withControls controlsPosition="bottom" controlStyle="icon" controlIcon="arrow" data-testid="category-carousel">
                {CATEGORIES.map((c) => (
                  <Carousel.Slide key={c.slug}>
                    <Link href={c.href} underline="hover" data-testid={`category-${c.slug}`}>
                      <Stack spacing="lg">
                        <Image src={c.image} alt="" ratio="3:4" radius="md" />
                        <Stack spacing={0}>
                          <Text size="textSm" weight="semiBold">{c.title}</Text>
                          <Text size="textSm" weight="semiBold" color="text-subtle">{c.blurb}</Text>
                        </Stack>
                      </Stack>
                    </Link>
                  </Carousel.Slide>
                ))}
              </Carousel>
            </Stack>
          </Container>
        </Section>
      </Box>

      <Box backgroundColor="extra-light" id="quality" className={HEADROOM} data-zone="quality">
        <Section size="lg">
          <Container width="wide">
            <Duplex media={<Image src={img.credibility} alt="Capsules poured from a PB Restore ProBiome Complex bottle into a hand" ratio="3:4" radius="xl" />}>
              <Stack spacing="lg">
                <Box><Badge level="primary" size="lg" shape="pill">CPTG Certified Pure Tested Grade®</Badge></Box>
                <BasicSection eyebrow="Why you can trust us" headline="Most tested. Most trusted."
                  body="On average dōTERRA runs 176 analyses on the life of a single oil, and more than 60 quality tests on every bottle." />
                <Accordion defaultExpanded="sourcing">
                  <Accordion.Item id="sourcing" size="md" title="Sourcing: where quality starts">
                    It starts with the plant. We partner with growers where each plant naturally thrives, and test from the first distillation onwards.
                  </Accordion.Item>
                  <Accordion.Item id="standard" size="md" title="The highest standard of sourcing">{PLACEHOLDER}</Accordion.Item>
                  <Accordion.Item id="matters" size="md" title="Why does quality matter?">{PLACEHOLDER}</Accordion.Item>
                </Accordion>
              </Stack>
            </Duplex>
          </Container>
        </Section>
      </Box>

      <Box id="offers" className={`${utilClassNames("py-13")} ${HEADROOM}`} data-zone="offers">
        <Container width="wide">
          <Stack spacing="xl">
            <Grid gap={{ xs: "md", lg: "xl" }} align="end">
              <Grid.Column span={{ xs: 12, lg: 9 }}>{sectionHeading("This month", "Offers & campaigns")}</Grid.Column>
              <Grid.Column span={{ xs: 12, lg: 3 }}>
                <Flex justify={{ xs: "start", lg: "end" }} spacing="md">
                  <Button as="a" href="#offers" variant="link-secondary" size="medium" data-testid="section-link-offers">All offers →</Button>
                </Flex>
              </Grid.Column>
            </Grid>
            <Grid gap="lg">
              {CAMPAIGNS.map((c) => (
                <Grid.Column key={c.headline} span={{ xs: 12, md: 4 }}>
                  <Spotlight backgroundImage={c.image} overlayColor="inverse" overlayOpacity={30} contentAlign="center" className={utilClassNames("py-7", "h-full")}>
                    <Flex align="center" spacing="xl" direction="column">
                      <Icon name="lightbulb-05" color="white" size="xl" />
                      <Flex spacing={3} direction="column">
                        <Text size="textXl" weight="extraBold" align="center" color="text-inverse-base">{c.label}</Text>
                        <Text as="h3" size="displayLg" weight="extraBold" align="center" color="text-inverse-base">{c.headline}</Text>
                        <Text size="textLg" align="center" color="text-inverse-base">{c.body}</Text>
                      </Flex>
                      <Button as="a" href={c.href} variant="secondary" size="xxlarge" className={utilClassNames("bg-base")} data-testid={c.testid}>{c.cta}</Button>
                    </Flex>
                  </Spotlight>
                </Grid.Column>
              ))}
            </Grid>
          </Stack>
        </Container>
      </Box>

      <Box backgroundColor="extra-light" id="faq" className={HEADROOM} data-zone="faq">
        <Section size="lg">
          <Container width="wide">
            <Grid gap={{ xs: "lg", lg: "xxl" }}>
              <Grid.Column span={{ xs: 12, lg: 4 }}>{sectionHeading("Questions and answers", "Frequently asked questions")}</Grid.Column>
              <Grid.Column span={{ xs: 12, lg: 8 }}>
                <Accordion variant="ghost" defaultExpanded="faq-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Accordion.Item key={n} id={`faq-${n}`} size="md" icon="help-circle" title="Frequently asked question" openIndicator={<Icon name="plus" size="md" />} closeIndicator={<Icon name="minus" size="md" />}>
                      <Stack spacing="md">
                        <Text size="textMd" color="text-secondary">{PLACEHOLDER}</Text>
                        <Text size="textMd" color="text-secondary">{`${PLACEHOLDER} ${PLACEHOLDER}`}</Text>
                      </Stack>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </Grid.Column>
            </Grid>
          </Container>
        </Section>
      </Box>

      <Box backgroundColor="inverse" id="newsletter" className={HEADROOM} data-zone="newsletter-contact">
        <Section size="lg">
          <Container width="wide">
            <Grid gap="lg">
              <Grid.Column span={{ xs: 12, lg: 7 }}>
                <Card radius="xl" borderWidth="none" shadow="none" overlay={img.newsletter}>
                  <div className="hp-feature-card">
                    <Card.Body padding="xxl" className={utilClassNames("align-left")}>
                      <Stack spacing="lg">
                        <Stack spacing="sm">
                          <Text size="textMd" weight="normal" color="text-inverse-base">Become a Member</Text>
                          <Text size="displaySm" weight="semiBold" color="text-inverse-base">Sign up to our newsletter</Text>
                          <Text size="textMd" weight="normal" color="text-inverse-base">Stay up-to-date with the latest doTERRA news and offers</Text>
                        </Stack>
                        <Stack spacing="md" direction={{ xs: "column", sm: "row" }}>
                          <Flex.Child grow={1}>
                            <TextInput id="newsletter-email" label="Email address" labelHidden type="email" placeholder="Enter your email address..." data-testid="newsletter-sign-up-email" />
                          </Flex.Child>
                          <Button variant="tertiary" size="small" data-testid="newsletter-sign-up-submit">Submit</Button>
                        </Stack>
                        <Text size="textXs" weight="normal" color="text-inverse-base">You can unsubscribe at any time</Text>
                      </Stack>
                    </Card.Body>
                  </div>
                </Card>
              </Grid.Column>
              <Grid.Column span={{ xs: 12, lg: 5 }}>
                <div data-testid="contact-us">
                  <Card radius="xl" borderWidth="none" shadow="none" className={utilClassNames("bg-primary")}>
                    <div className="hp-feature-card">
                      <Card.Body padding="xxl" className={utilClassNames("align-left")}>
                        <Stack spacing="lg">
                          <Stack spacing="sm">
                            <Text size="textMd" weight="normal" color="text-inverse-base">Contact Us</Text>
                            <Text size="displaySm" weight="semiBold" color="text-inverse-base">Stay in touch</Text>
                            <Stack spacing="md">
                              <Flex spacing="md">
                                <Button as="a" href="#help" variant="link-tertiary" size="small" icon="help-circle" iconPosition="left" data-testid="contact-help-center">Help Center</Button>
                                <Button as="a" href="mailto:support@example.invalid" variant="link-tertiary" size="small" icon="mail-01" iconPosition="left" data-testid="contact-email">Email</Button>
                              </Flex>
                              <Flex spacing="md">
                                <Button as="a" href="tel:8004118151" variant="link-tertiary" size="small" icon="phone" iconPosition="left" data-testid="contact-800-411-8151">800.411.8151</Button>
                                <Button as="a" href="#chat" variant="link-tertiary" size="small" icon="message-chat-square" iconPosition="left" data-testid="contact-live-chat">Live chat</Button>
                              </Flex>
                            </Stack>
                          </Stack>
                          <Flex spacing="md">
                            {SOCIAL.map(({ name, label }) => (
                              <a key={name} href={`#${name.toLowerCase()}`} aria-label={label}><SocialIcon name={name} color="white" size="xl" /></a>
                            ))}
                          </Flex>
                        </Stack>
                      </Card.Body>
                    </div>
                  </Card>
                </div>
              </Grid.Column>
            </Grid>
          </Container>
        </Section>
      </Box>
    </Main>
  );
}
