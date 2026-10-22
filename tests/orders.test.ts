import { test } from "node:test";
import assert from "node:assert/strict";
import golden from "./golden/orders.json" with { type: "json" };
import { NAVIGATION_CONTENT } from "../src/shell/domain/tasks.ts";
import { applyOverrides, buildPlan, isFooterTask, mulberry32, orderFor, participantIndex, rosterOrders, shuffleApart, sessionOrder } from "../src/shell/domain/order.ts";

test("roster orders reproduce the FigJam board exactly (seed 13102026)", () => {
  assert.deepEqual(rosterOrders(), golden.orders);
});

test("desktop orders never place T1 and T2 next to each other", () => {
  for (let i = 1; i <= 10; i++) {
    const o = golden.orders["P" + i as keyof typeof golden.orders];
    assert.ok(Math.abs(o.indexOf("T1") - o.indexOf("T2")) > 1, `P${i}`);
  }
});

const FOOTER = ["T11", "T12"];

test("roster participants keep the board's order for the ten tasks it knew, with the footer tasks placed among them", () => {
  for (const id of ["P1", "P3", "P10"]) {
    const order = sessionOrder(NAVIGATION_CONTENT, id);
    assert.equal(order.length, 12);
    assert.deepEqual(order.filter((t) => !FOOTER.includes(t)), (golden.orders as Record<string, string[]>)[id], id);
  }
  assert.deepEqual(sessionOrder(NAVIGATION_CONTENT, "P3"), sessionOrder(NAVIGATION_CONTENT, "P3"), "repeatable");
});

test("a footer-only task is never first, for anyone: the first task is where H6 (menus open unaided) is read", () => {
  for (let i = 1; i <= 60; i++) for (const id of ["P" + i, "M" + i, "anyone" + i]) assert.ok(!FOOTER.includes(sessionOrder(NAVIGATION_CONTENT, id)[0]!), id);
  assert.ok(isFooterTask(NAVIGATION_CONTENT.tasks.find((t) => t.id === "T11")!));
  assert.ok(isFooterTask(NAVIGATION_CONTENT.tasks.find((t) => t.id === "T12")!));
  assert.ok(!isFooterTask(NAVIGATION_CONTENT.tasks.find((t) => t.id === "T3")!), "T3 is reachable from the header (and the footer): not footer only");
  const positions = new Set<number>();
  for (let i = 1; i <= 40; i++) positions.add(sessionOrder(NAVIGATION_CONTENT, "P" + i).indexOf("T11"));
  assert.ok(positions.size > 4, "the footer tasks land at varied places in the session");
});

test("a session starts with the core tasks only: reserves are offered at the end", () => {
  const order = sessionOrder(NAVIGATION_CONTENT, "P1");
  assert.equal(order.length, 12);
  assert.ok(!order.includes("R1") && !order.includes("R2"));
});

test("every participant gets all twelve core tasks, whatever their ID: breakpoints are per task, not per person", () => {
  for (const id of ["P1", "P11", "M2", "TB3", "anyone"]) assert.deepEqual([...sessionOrder(NAVIGATION_CONTENT, id)].sort(), [...golden.orders.P1, ...FOOTER].sort(), id);
});

test("non-roster participants get a repeatable seeded order with T1 and T2 apart", () => {
  const ids = NAVIGATION_CONTENT.tasks.filter((t) => !t.reserve).map((t) => t.id);
  const a = orderFor("P11", ids), b = orderFor("P11", ids), c = orderFor("P12", ids);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.deepEqual([...a].sort(), [...ids].sort());
  assert.ok(Math.abs(a.indexOf("T1") - a.indexOf("T2")) > 1);
});

test("shuffleApart terminates even when the only possible orders are adjacent", () => {
  const o = shuffleApart(["T1", "T2"], mulberry32(1));
  assert.deepEqual([...o].sort(), ["T1", "T2"]);
});

const order10 = sessionOrder(NAVIGATION_CONTENT, "P1");
const dual = NAVIGATION_CONTENT.tasks.filter((t) => t.breakpoints.length > 1).map((t) => t.id);

test("a task that runs at one breakpoint always uses it, for everyone", () => {
  for (let i = 1; i <= 12; i++) {
    const plan = buildPlan(NAVIGATION_CONTENT, order10, "P" + i);
    for (const id of ["T2", "T4", "T6", "T8"]) assert.equal(plan[id], "desktop", `P${i} ${id}`);
  }
});

test("tasks that list several breakpoints rotate across exactly those, balanced across participants", () => {
  assert.deepEqual(dual, ["T1", "T3", "T5", "T7", "T9", "T10", "T11", "T12"]);
  const seen: Record<string, Record<string, number>> = {};
  for (let i = 1; i <= 12; i++) {
    const plan = buildPlan(NAVIGATION_CONTENT, order10, "P" + i);
    const mine = dual.map((id) => plan[id]);
    for (const b of ["desktop", "mobile", "tablet"]) assert.ok([2, 3].includes(mine.filter((x) => x === b).length), `P${i} gets two or three of the eight at ${b}`);
    for (const id of dual) { (seen[id] ??= {})[plan[id]!] = ((seen[id] ??= {})[plan[id]!] ?? 0) + 1; }
  }
  for (const id of dual) assert.deepEqual(seen[id], { desktop: 4, mobile: 4, tablet: 4 }, `${id} is seen four times at each breakpoint across twelve participants`);
});

test("tablet is used only by tasks that list it, with no setup option", () => {
  const content = structuredClone(NAVIGATION_CONTENT);
  for (const t of content.tasks) t.breakpoints = t.breakpoints.filter((b) => b !== "tablet");
  for (let i = 1; i <= 6; i++) assert.ok(Object.values(buildPlan(content, order10, "P" + i)).every((b) => b !== "tablet"));
  const used = new Set<string>();
  for (let i = 1; i <= 6; i++) for (const b of Object.values(buildPlan(NAVIGATION_CONTENT, order10, "P" + i))) used.add(b);
  assert.ok(used.has("tablet"));
});

test("a plan is repeatable, and the participant number comes from the end of the ID", () => {
  assert.deepEqual(buildPlan(NAVIGATION_CONTENT, order10, "P3"), buildPlan(NAVIGATION_CONTENT, order10, "P3"));
  assert.equal(participantIndex("P7"), 7);
  assert.equal(participantIndex("TB12"), 12);
  assert.equal(participantIndex("anna"), participantIndex("anna"));
});

test("overrides win only where the task can run there", () => {
  const base = buildPlan(NAVIGATION_CONTENT, order10, "P1");
  const plan = applyOverrides(base, { T1: base.T1 === "mobile" ? "desktop" : "mobile", T2: "mobile", T99: "mobile" }, NAVIGATION_CONTENT);
  assert.notEqual(plan.T1, base.T1, "T1 lists both, so the moderator's choice is used");
  assert.equal(plan.T2, "desktop", "T2 is desktop only, so a mobile override is ignored");
  assert.equal("T99" in plan, false);
});
