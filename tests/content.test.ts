import { test } from "node:test";
import assert from "node:assert/strict";
import navigation from "../src/proto/data/navigation.json" with { type: "json" };
import { DEFAULT_CONTENT } from "../src/shell/domain/tasks.ts";
import { validateContent } from "../src/shell/domain/content.ts";
import { allHeaderEntries, hrefExists, lookupFooter, lookupHeader, normaliseHref } from "../src/shared/navIndex.ts";

const clone = () => structuredClone(DEFAULT_CONTENT) as typeof DEFAULT_CONTENT;
const errorsOf = (c: unknown) => { const r = validateContent(c); return r.ok ? [] : r.errors; };

test("the default content is valid, and every target href exists in the navigation or footer data", () => {
  const r = validateContent(DEFAULT_CONTENT);
  assert.equal(r.ok, true);
  const targets = DEFAULT_CONTENT.tasks.flatMap((t) => [...t.primary, ...t.acceptable, ...t.separate]);
  assert.ok(targets.length > 15);
  for (const t of targets) assert.ok(hrefExists(t.href), t.href);
});

test("there are 14 tasks: 12 core (the plan's ten and two footer tasks) and 2 reserves, with the plan's high-risk set", () => {
  assert.equal(DEFAULT_CONTENT.tasks.length, 14);
  assert.deepEqual(DEFAULT_CONTENT.tasks.filter((t) => t.reserve).map((t) => t.id), ["R1", "R2"]);
  assert.deepEqual(DEFAULT_CONTENT.tasks.filter((t) => t.highRisk).map((t) => t.id), ["T1", "T2", "T9", "T10"]);
  assert.deepEqual(DEFAULT_CONTENT.tasks.filter((t) => t.breakpoints.includes("mobile")).map((t) => t.id), ["T1", "T3", "T5", "T7", "T9", "T10", "T11", "T12"]);
});

test("header hrefs are unique across the whole navigation, so an href identifies one link", () => {
  interface L { href: string; children?: L[] }
  let total = 0;
  const walk = (links: L[]) => { for (const l of links) { total += 1; walk(l.children ?? []); } };
  for (const item of navigation.items as unknown as { type: string; links?: L[]; columns?: { links: L[] }[]; featured?: { link: L } }[]) {
    if (item.type === "dropdown") walk(item.links ?? []);
    else { for (const c of item.columns ?? []) walk(c.links); if (item.featured) walk([item.featured.link]); }
  }
  assert.equal(allHeaderEntries().length, total);
});

/**
 * The navigation as the tree test holds it after the card sort (Arm R, Tree Testing Tool wayfinding-trial.html, 12 Oct 2026):
 * top level, group, labels in order. The prototype adds children (Single Oils and so on) that the tree does not model.
 */
const TREE: Record<string, Record<string, string[]>> = {
  Shop: {
    "Shop by Category": ["Essential Oils", "Personal Care", "Accessories", "Supplements", "Literature", "Collections & Enrollment", "Created For", "New Products", "View all products"],
    "Shop by Goal": ["Sleep Solutions", "Stress Solutions", "Pain Solutions", "Immunity Solutions", "Digestion Solutions", "Respiratory Solutions", "Focus Solutions", "Detox Solutions", "Skin Solutions", "Hormone Solutions", "Metabolic Solutions"],
    Highlights: ["Best Sellers", "New Products", "Limited Time Offers", "Exclusive Kits"],
  },
  Learn: {
    "Essential Oils": ["Discover Solutions", "What Are Essential Oils", "How to Use Essential Oils", "Essential Oil Safety", "Certified Pure Testing Grade", "Where to Buy Essential Oils", "Product Training"],
    Business: ["Business Opportunity", "doTERRA Pro", "Path to $500", "Business Hub", "Business Resources"],
    "Blog & Resources": ["Healthy Living", "Recipes", "doTERRA at Home", "Living Magazine"],
  },
  "Our Story": {
    "About doTERRA": ["Our Story", "Founders", "Corporate", "Chief Field Officers", "Why doTERRA", "Healing Hands Foundation", "Source to You"],
    Events: ["Convention", "Leadership Retreat", "Incentive Trip"],
  },
};

test("the prototype's navigation is the post-card-sort IA the tree test holds: same groups, same links, same order", () => {
  interface Link { label: string; href: string }
  const items = navigation.items as unknown as { label: string; type: string; columns?: { title: string; links: Link[] }[]; links?: Link[] }[];
  const actual: Record<string, Record<string, string[]>> = {};
  for (const item of items) if (item.type === "megaMenu") actual[item.label] = Object.fromEntries((item.columns ?? []).map((c) => [c.title, c.links.map((l) => l.label)]));
  assert.deepEqual(actual, TREE);
  const rewards = items.find((i) => i.label === "Rewards")!;
  assert.deepEqual(rewards.links!.map((l) => l.label), ["Loyalty Rewards Program", "Enrollment Options", "Wholesale Membership"]);
  // The groups that were dissolved or merged are gone, and no link survives under the old paths.
  const hrefs = allHeaderEntries().map((e) => e.href);
  assert.ok(!hrefs.some((h) => h.startsWith("/learn/resources") || h.startsWith("/our-story/difference")), "no link under the dissolved groups");
  assert.ok(!hrefs.includes("/shop/limited-time-offers") && !hrefs.includes("/shop/highlights/new-arrivals"));
});

test("the footer points at the moved pages' new addresses, so one page never has two", () => {
  for (const gone of ["/learn/resources/essential-oil-safety", "/learn/resources/certified-pure-testing-grade", "/our-story/difference/why-doterra", "/our-story/difference/source-to-you", "/our-story/difference/healing-hands-foundation", "/shop/limited-time-offers"]) {
    assert.equal(lookupFooter(gone).length, 0, gone);
  }
  assert.ok(lookupFooter("/learn/essential-oils/essential-oil-safety").length > 0);
  assert.ok(lookupFooter("/shop/highlights/limited-time-offers").length > 0);
});

test("lookups describe where a link lives", () => {
  assert.deepEqual(lookupHeader("/shop/highlights/limited-time-offers"), { href: "/shop/highlights/limited-time-offers", label: "Limited Time Offers", section: "shop", column: "Highlights", area: "header" });
  assert.equal(lookupHeader("/shop/limited-time-offers"), undefined, "Limited Time Offers is no longer in Shop by Category");
  assert.equal(lookupHeader("/learn/essential-oils/essential-oil-safety")!.column, "Essential Oils");
  assert.equal(lookupHeader("/our-story/about/source-to-you")!.column, "About doTERRA");
  assert.equal(lookupHeader("/rewards/wholesale-membership")!.column, "Rewards");
  assert.equal(lookupHeader("/shop/essential-oils/single-oils")!.column, "Shop by Category", "a child link belongs to its parent's column");
  assert.ok(lookupFooter("/shop").length > 0, "footer hrefs live in their own index");
  assert.equal(normaliseHref("/shop/?a=1#x"), "/shop");
  assert.equal(normaliseHref("/"), "/");
});

test("validation rejects duplicate ids, unknown links, bad breakpoints and missing primaries", () => {
  const dup = clone(); dup.tasks[1]!.id = "T1";
  assert.match(errorsOf(dup).join("|"), /used twice/);
  const unknown = clone(); unknown.tasks[0]!.primary = [{ href: "/nope" }];
  assert.match(errorsOf(unknown).join("|"), /is not a link in the navigation or footer/);
  const bp = clone(); (bp.tasks[0] as { breakpoints: string[] }).breakpoints = ["watch"];
  assert.match(errorsOf(bp).join("|"), /breakpoints must be a list/);
  const none = clone(); none.tasks[0]!.primary = [];
  assert.match(errorsOf(none).join("|"), /needs at least one target/);
});

test("validation rejects em dashes in any text and non-object input", () => {
  const c = clone(); c.tasks[0]!.scenario = "Find sleep \u2014 quickly";
  assert.match(errorsOf(c).join("|"), /em dash/);
  for (const junk of [null, 4, "x", [], { tasks: [] }]) assert.ok(errorsOf(junk).length > 0);
});

test("validation drops unknown fields and trims text to safe lengths", () => {
  const c = clone() as unknown as { tasks: Record<string, unknown>[] };
  c.tasks[0]!.secret = "x"; c.tasks[0]!.scenario = "s".repeat(5000);
  const r = validateContent(c);
  assert.equal(r.ok, true);
  if (r.ok) { assert.equal("secret" in r.content.tasks[0]!, false); assert.equal(r.content.tasks[0]!.scenario.length, 600); }
});

test("no em dash appears anywhere in the default content", () => {
  assert.ok(!JSON.stringify(DEFAULT_CONTENT).includes("\u2014"));
});

test("link checking can be turned off, which is how a session's own snapshot is read", () => {
  const c = clone(); c.tasks[0]!.primary = [{ href: "/gone/in/a/later/build" }];
  assert.equal(validateContent(c).ok, false);
  assert.equal(validateContent(c, { checkLinks: false }).ok, true);
});
