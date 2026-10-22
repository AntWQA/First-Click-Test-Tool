import type { ReactNode } from "react";
import { Box, Container, Flex, Grid, Image, Stack, Text, utilClassNames } from "@doterra-it/design-system-ui-base";
import "./home.css";

/**
 * Four blocks the homepage design uses that the installed Pure (2.6.0) does not export: Hero, BasicSection, CtaCard and
 * Duplex. They render the same markup and classes as the newer Pure build the design was made with, built from installed
 * Pure components (Container, Stack, Text, Flex, Image, Card), and their rules live in home.css with an hp- prefix.
 * Replace them with the library components when Pure is upgraded.
 */

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");

// ---------- Hero ----------

interface HeroProps {
  tagline: string;
  title: string;
  /** Everything under the title: the description, buttons and figures */
  children: ReactNode;
  image: string;
}

/** Full-width image hero, content bottom left on a dark gradient (the design's "xl", "left", "bottom", "dark" settings). */
export function Hero({ tagline, title, children, image }: HeroProps) {
  return (
    <div className="hp-hero hp-hero--has-media hp-hero--left hp-hero--position-bottom hp-hero--dark hp-hero--content-lg hp-hero--border-radius-xl hp-hero--height-xl">
      <Container className="hp-hero__container">
        <div className="hp-hero__main">
          <Text size={{ xs: "textLg", md: "textXl" }} className="hp-hero__tagline">{tagline}</Text>
          <Text as="h1" size={{ xs: "displayMd", md: "displayLg" }} weight="extraBold" className="hp-hero__title">{title}</Text>
          <Text as="div" size={{ xs: "textMd", md: "textXl" }} className="hp-hero__description">{children}</Text>
        </div>
      </Container>
      <div className="hp-hero__background">
        <img className="hp-hero__background-image" src={image} alt="" loading="eager" decoding="async" aria-hidden="true" />
        <div className={cx("hp-hero__overlay hp-hero__overlay--dark hp-hero__overlay--gradient", utilClassNames("bg-opacity-80"))} aria-hidden="true" />
      </div>
    </div>
  );
}

// ---------- BasicSection ----------

interface BasicSectionProps {
  eyebrow?: string;
  headline: ReactNode;
  headlineAs?: "h2" | "h3";
  body?: ReactNode;
  /** "lg" is a section heading, "sm" is the text block inside a CtaCard */
  size?: "lg" | "sm";
  /** A button row under the text (CtaCard only) */
  cta?: ReactNode;
}

/** Eyebrow, headline and body, left aligned. */
export function BasicSection({ eyebrow, headline, headlineAs = "h2", body, size = "lg", cta }: BasicSectionProps) {
  if (size === "sm") {
    return (
      <div className="hp-basic-section hp-basic-section--left hp-cta-card__text">
        <Stack spacing={5}>
          <Stack spacing={2}>
            <Stack spacing={3}>
              <Text as={headlineAs} size="displayXs" weight="extraBold" className="hp-basic-section__headline">{headline}</Text>
            </Stack>
            {body && <Text size="textSm" weight="normal" className="hp-basic-section__body">{body}</Text>}
          </Stack>
          {cta && <Flex justify="start" spacing={3}>{cta}</Flex>}
        </Stack>
      </div>
    );
  }
  return (
    <div className="hp-basic-section hp-basic-section--left">
      <Stack spacing={6}>
        <Stack spacing={5}>
          {eyebrow && <Text as="div" size="textLg" weight="normal" className="hp-basic-section__eyebrow">{eyebrow}</Text>}
          <Stack spacing={3}>
            <Text as={headlineAs} size="displayLg" weight="extraBold" className="hp-basic-section__headline">{headline}</Text>
          </Stack>
          {body && <Text as="div" size="textLg" weight="normal" className="hp-basic-section__body">{body}</Text>}
        </Stack>
      </Stack>
    </div>
  );
}

// ---------- CtaCard ----------

interface CtaCardProps {
  image: string;
  headline: string;
  body: string;
  cta: ReactNode;
}

/** Flat image-on-top card: a 4:3 photo, then a headline, a line of text and one button. */
export function CtaCard({ image, headline, body, cta }: CtaCardProps) {
  return (
    <div className="dtds-card dtds-border-radius-xl dtds-shadow-none dtds-corner-shape-squircle dtds-flex-column hp-cta-card hp-cta-card--variant-image hp-cta-card--layout-left hp-cta-card--ratio-4-3 hp-cta-card--size-sm hp-cta-card--flat">
      <div className="hp-cta-card__media" data-testid="cta-card-media">
        <Image src={image} alt="" ratio="4:3" radius="lg" />
      </div>
      <div className="hp-cta-card__content">
        <BasicSection size="sm" headlineAs="h3" headline={headline} body={body} cta={cta} />
      </div>
    </div>
  );
}

// ---------- Duplex ----------

interface DuplexProps {
  media: ReactNode;
  children: ReactNode;
}

/** Two equal columns, media left and content right, vertically centred; stacks below 768px. */
export function Duplex({ media, children }: DuplexProps) {
  return (
    <div className="hp-duplex hp-duplex--size-lg">
      <Box>
        <Stack spacing={8}>
          <Grid gap={{ xs: "xl", md: "xxxl", lg: "xxxl" }} align="center">
            <Grid.Column span={{ xs: 12, md: 6 }} className="hp-duplex__media-column">
              <Box className="hp-duplex__media">{media}</Box>
            </Grid.Column>
            <Grid.Column span={{ xs: 12, md: 6 }} className="hp-duplex__content-column">{children}</Grid.Column>
          </Grid>
        </Stack>
      </Box>
    </div>
  );
}
