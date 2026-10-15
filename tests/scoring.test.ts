import { test } from "node:test";
import assert from "node:assert/strict";
import { suggest } from "../src/shell/domain/scoring.ts";
import { click, close, leaf, open, ready, task } from "./helpers.ts";

const GOAL = "Shop by Goal";

test("primary path on desktop: P, both levels hit, first interaction measured from ready", () => {
  const s = suggest(task("T1"), [ready(50), open("shop", 250), leaf("/shop/goal/sleep-solutions", "shop", GOAL, 1500), close("shop", 1500)], "destination");
  assert.equal(s.tier, "P");
  assert.equal(s.code, null);
  assert.equal(s.level1, true);
  assert.equal(s.level2, true);
  assert.equal(s.levelOneSection, "shop");
  assert.equal(s.firstInteractionMs, 200);
});

test("a sweep across another menu on the way does not become the section choice (dwell rule), but the raw first open is kept", () => {
  const s = suggest(task("T1"), [ready(0), open("learn", 100), close("learn", 250), open("shop", 300), leaf("/shop/goal/sleep-solutions", "shop", GOAL, 2000), close("shop", 2000)], "destination");
  assert.equal(s.firstOpenSection, "learn");
  assert.equal(s.levelOneSection, "shop");
  assert.equal(s.level1, true);
  assert.deepEqual(s.sectionsOpened, ["learn", "shop"]);
});

test("a menu opened too briefly to dwell falls back to the section of the final click", () => {
  const s = suggest(task("T1"), [ready(0), open("learn", 100), close("learn", 200), open("shop", 300), leaf("/shop/goal/sleep-solutions", "shop", GOAL, 450), close("shop", 450)], "destination");
  assert.equal(s.levelOneSection, "shop");
  assert.equal(s.level1, true);
});

test("wrong section: X, code 1, level 1 false", () => {
  const s = suggest(task("T1"), [ready(0), open("learn", 100), leaf("/learn/essential-oils/discover-solutions", "learn", "Essential Oils", 2500), close("learn", 2500)], "destination");
  assert.equal(s.tier, "X");
  assert.equal(s.code, 1);
  assert.equal(s.level1, false);
  assert.equal(s.level2, false);
  assert.equal(s.finalSection, "learn");
});

test("right section, wrong column: code 2; right column, wrong link: code 3", () => {
  const wrongColumn = suggest(task("T1"), [ready(0), open("shop", 100), leaf("/shop/new-products", "shop", "Shop by Category", 1500), close("shop", 1500)], "destination");
  assert.equal(wrongColumn.code, 2);
  assert.equal(wrongColumn.level1, true);
  const wrongLink = suggest(task("T1"), [ready(0), open("shop", 100), leaf("/shop/goal/stress-solutions", "shop", GOAL, 1500), close("shop", 1500)], "destination");
  assert.equal(wrongLink.code, 3);
  assert.equal(wrongLink.tier, "X");
});

test("duplicate answers: New Products has two homes, the Highlights route is primary and the Category route acceptable, and the column shows the route", () => {
  const hl = suggest(task("T4"), [ready(0), open("shop", 100), leaf("/shop/highlights/new-products", "shop", "Highlights", 1500), close("shop", 1500)], "destination");
  assert.equal(hl.tier, "P");
  assert.equal(hl.finalColumn, "Highlights");
  const cat = suggest(task("T4"), [ready(0), open("shop", 100), leaf("/shop/new-products", "shop", "Shop by Category", 1500), close("shop", 1500)], "destination");
  assert.equal(cat.tier, "A");
  assert.equal(cat.finalColumn, "Shop by Category");
});

test("Limited Time Offers now lives only in Highlights: it is primary there, and a first click into Category is a wrong column", () => {
  const hl = suggest(task("T3"), [ready(0), open("shop", 100), leaf("/shop/highlights/limited-time-offers", "shop", "Highlights", 1500), close("shop", 1500)], "destination");
  assert.equal(hl.tier, "P");
  const cat = suggest(task("T3"), [ready(0), open("shop", 100), leaf("/shop/new-products", "shop", "Shop by Category", 1500), close("shop", 1500)], "destination");
  assert.equal(cat.tier, "X");
  assert.equal(cat.code, 2);
});

test("hrefs are compared without trailing slash, query or hash", () => {
  const s = suggest(task("T1"), [ready(0), open("shop", 100), leaf("/shop/goal/sleep-solutions/?ref=x#top", "shop", GOAL, 1500)], "destination");
  assert.equal(s.tier, "P");
});

test("an answer recorded separately is S: neither hit nor miss", () => {
  const s = suggest(task("T5"), [ready(0), open("our-story", 100), leaf("/our-story/about/source-to-you", "our-story", "About doTERRA", 2000), close("our-story", 2000)], "destination");
  assert.equal(s.tier, "S");
  assert.equal(s.level2, null);
  assert.equal(s.level1, null, "the answer is in Our Story, the target in Learn: unconfirmed, so not a Level 1 miss either");
  const inLearn = suggest(task("T5"), [ready(0), open("learn", 100), leaf("/our-story/about/source-to-you", "our-story", "About doTERRA", 2000), close("learn", 2000)], "destination");
  assert.equal(inLearn.level1, true, "holding Learn open for the dwell time is still a section hit");
});

test("a footer link that matches a target counts as that target, flagged as via footer", () => {
  const s = suggest(task("T10"), [ready(0), leaf("/learn/business/business-opportunity", "footer", "Rewards & Business", 4000, "footer")], "destination");
  assert.equal(s.tier, "P");
  assert.equal(s.viaFooter, true);
  assert.equal(s.finalSection, "footer");
});

test("a footer link that is not a target is X with code 5", () => {
  const s = suggest(task("T10"), [ready(0), leaf("/legal/privacy-policy", "footer", "Legal", 4000, "footer")], "destination");
  assert.equal(s.tier, "X");
  assert.equal(s.code, 5);
});

test("search is recorded only (R, code 4): not a miss", () => {
  const s = suggest(task("T1"), [ready(0), click("search", 500), { type: "search-submit", at: 3000, query: "sleep" }], "destination");
  assert.equal(s.tier, "R");
  assert.equal(s.code, 4);
  assert.equal(s.level2, null);
  assert.equal(s.level1, null);
});

test("search followed by a leaf click is judged on the leaf", () => {
  const s = suggest(task("T1"), [ready(0), { type: "search-submit", at: 1000, query: "sleep" }, open("shop", 2000), leaf("/shop/goal/sleep-solutions", "shop", GOAL, 4000)], "destination");
  assert.equal(s.tier, "P");
});

test("logo and utility clicks that do not end the task are ignored for the outcome", () => {
  const s = suggest(task("T1"), [ready(0), click("logo", 300), click("utility", 600), open("shop", 900), leaf("/shop/goal/sleep-solutions", "shop", GOAL, 2500)], "destination");
  assert.equal(s.tier, "P");
  assert.equal(s.firstInteractionMs, 300);
});

test("gave up with nothing chosen: X, code 6, both levels false", () => {
  const s = suggest(task("T1"), [ready(0)], "gave-up");
  assert.equal(s.tier, "X");
  assert.equal(s.code, 6);
  assert.equal(s.level1, false);
  assert.equal(s.level2, false);
  assert.equal(s.firstInteractionMs, null);
});

test("pressing 'I found it' without choosing a destination is flagged", () => {
  const s = suggest(task("T1"), [ready(0), open("shop", 200)], "found");
  assert.equal(s.tier, "X");
  assert.equal(s.foundWithoutDestination, true);
});

test("mobile and tablet: the first section row opened is the section choice, with no dwell rule", () => {
  const s = suggest(task("T5"), [ready(0), click("menu-toggle", 200), open("learn", 600, "drill", "click"), leaf("/learn/essential-oils/certified-pure-testing-grade", "learn", "Essential Oils", 1500)], "destination");
  assert.equal(s.tier, "P");
  assert.equal(s.levelOneSection, "learn");
  assert.equal(s.level1, true);
  assert.equal(s.firstInteractionMs, 200);
});

test("mobile: opening the wrong section first is Level 1 false even when the final link is right", () => {
  const s = suggest(task("T5"), [ready(0), open("shop", 400, "drill", "click"), open("learn", 1500, "drill", "click"), leaf("/learn/essential-oils/certified-pure-testing-grade", "learn", "Essential Oils", 2500)], "destination");
  assert.equal(s.tier, "P");
  assert.equal(s.levelOneSection, "shop");
  assert.equal(s.level1, false);
});

test("a sub-dwell sweep is not a section choice: gave up after a 50 ms hover, Level 1 is a miss with no choice", () => {
  const s = suggest(task("T1"), [ready(0), open("shop", 100), close("shop", 150)], "gave-up", 9000);
  assert.equal(s.levelOneSection, null);
  assert.equal(s.level1, false);
  assert.equal(s.firstOpenSection, "shop");
});

test("a search after a brief sweep stays Recorded only with no Level 1 verdict", () => {
  const s = suggest(task("T1"), [ready(0), open("shop", 100), close("shop", 150), { type: "search-submit", at: 3000, query: "sleep" }], "destination", 3000);
  assert.equal(s.tier, "R");
  assert.equal(s.level1, null);
});

test("a menu left open until the participant gave up is measured to the moment they gave up", () => {
  const events = [ready(0), open("learn", 1000)];
  assert.equal(suggest(task("T5"), events, "gave-up", 21000).levelOneSection, "learn", "twenty seconds on Learn is a choice");
  assert.equal(suggest(task("T5"), events, "gave-up", 1100).levelOneSection, null, "a tenth of a second is not");
  assert.equal(suggest(task("T5"), events, "gave-up").levelOneSection, null, "with no end time it falls back to the last event");
});

test("a footer answer with no menu used has no section choice to judge", () => {
  const s = suggest(task("T10"), [ready(0), leaf("/learn/business/business-opportunity", "footer", "Rewards & Business", 4000, "footer")], "destination", 4000);
  assert.equal(s.tier, "P");
  assert.equal(s.level1, null);
});

test("footer tasks: the footer link is the answer, so it scores as a hit with no section to judge; header guesses and Help are told apart", () => {
  const hit = suggest(task("T11"), [ready(0), leaf("/support/contact", "footer", "Support", 6000, "footer")], "destination");
  assert.equal(hit.tier, "P");
  assert.equal(hit.viaFooter, true);
  assert.equal(hit.level1, null, "no header section holds the answer, so there is no section choice to judge");
  assert.equal(hit.level2, true);
  const help = suggest(task("T11"), [ready(0), leaf("/support/help", "footer", "Support", 6000, "footer")], "destination");
  assert.equal(help.tier, "S", "Help is recorded separately until its page content is confirmed");
  const guess = suggest(task("T12"), [ready(0), open("learn", 100), leaf("/learn/essential-oils/product-training", "learn", "Essential Oils", 1500), close("learn", 1500)], "destination");
  assert.equal(guess.tier, "X");
  assert.equal(guess.code, 1, "a header section that holds none of the answers is a wrong section");
  const legal = suggest(task("T12"), [ready(0), leaf("/legal/returns-policy", "footer", "Legal", 9000, "footer")], "destination");
  assert.equal(legal.tier, "P");
  const wrongFooter = suggest(task("T12"), [ready(0), leaf("/legal/privacy-policy", "footer", "Legal", 9000, "footer")], "destination");
  assert.equal(wrongFooter.tier, "X");
  assert.equal(wrongFooter.code, 5);
});
