import type { Breakpoint } from "../../shared/protocol.ts";

export interface TargetSpec {
  href: string;
  note?: string;
}

export interface Task {
  id: string;
  title: string;
  /** Read to the participant. Wording is reused from the tree test where a matching task exists, so results can be compared. */
  scenario: string;
  /** Breakpoints this task runs at. A session at a breakpoint skips tasks that do not list it. */
  breakpoints: Breakpoint[];
  reserve: boolean;
  highRisk: boolean;
  hypotheses: string[];
  /** The intended path. */
  primary: TargetSpec[];
  /** A reasonable alternative, agreed before fieldwork. */
  acceptable: TargetSpec[];
  /** Plausible answers whose page content is not yet confirmed. Recorded separately, never scored as a miss or a hit. */
  separate: TargetSpec[];
  watchFor: string;
  needBack: string[];
}

export interface Content {
  schemaVersion: 1;
  version: number;
  updatedAt: string;
  tasks: Task[];
}

const ALL: Breakpoint[] = ["desktop", "tablet", "mobile"];
const DESKTOP: Breakpoint[] = ["desktop"];

export const DEFAULT_TASKS: Task[] = [
  {
    id: "T1", title: "Sleep", breakpoints: ALL, reserve: false, highRisk: true, hypotheses: ["H1", "H6"],
    scenario: "You've been having trouble getting a good night's sleep and want to see what doTERRA offers to help.",
    primary: [{ href: "/shop/goal/sleep-solutions" }], acceptable: [], separate: [],
    watchFor: "Learn > Essential Oils > Discover Solutions (education reading). Shop by Category > Essential Oils (product reading). Search.",
    needBack: ["Whether they read the Shop by Goal column title before choosing (observed, not inferred)", "After the click, verbatim: what they expect to find on Sleep Solutions", "Count of Learn and Essential Oils picks"],
  },
  {
    id: "T2", title: "Cough", breakpoints: DESKTOP, reserve: false, highRisk: true, hypotheses: ["H1"],
    scenario: "You've had a cough you can't shake and want to find products that could support your breathing.",
    primary: [{ href: "/shop/goal/respiratory-solutions" }], acceptable: [], separate: [],
    watchFor: "Learn > Essential Oils > Discover Solutions. Shop by Category > Essential Oils or Supplements. Search.",
    needBack: ["Scan behaviour across the 11 goals: time from menu open to click, and whether the pointer passed over the target", "Compare with T1: does symptom wording score lower than goal wording?"],
  },
  {
    id: "T3", title: "Deals", breakpoints: ALL, reserve: false, highRisk: false, hypotheses: ["H2"],
    scenario: "Find out what deals or discounted products are available right now.",
    primary: [{ href: "/shop/highlights/limited-time-offers" }], acceptable: [], separate: [],
    watchFor: "Shop by Category (the link was removed from there: a first click into Category is the test of that removal). Highlights > Best Sellers. Rewards (member pricing reading). Shop > View all products. Search.",
    needBack: ["Whether they looked in Shop by Category first, and what they did when it was not there", "Whether they looked at both columns before choosing", "Whether Rewards was chosen, and why"],
  },
  {
    id: "T4", title: "New products", breakpoints: DESKTOP, reserve: false, highRisk: false, hypotheses: ["H2"],
    scenario: "You've been using doTERRA for a while and want to see which products have launched recently.",
    primary: [{ href: "/shop/highlights/new-products" }], acceptable: [{ href: "/shop/new-products" }], separate: [],
    watchFor: "Highlights > Best Sellers or Exclusive Kits. Limited Time Offers. Search.",
    needBack: ["Route taken (Highlights or Category) as its own field", "Whether they noticed that New Products sits in both Shop by Category and Highlights, and whether they took it to be the same page. Ask only if they raise it"],
  },
  {
    id: "T5", title: "Lab testing", breakpoints: ALL, reserve: false, highRisk: false, hypotheses: ["H3"],
    scenario: "A friend told you doTERRA's oils are checked by outside laboratories to make sure they're genuine. You'd like to read about how that works.",
    primary: [{ href: "/learn/essential-oils/certified-pure-testing-grade" }], acceptable: [],
    separate: [{ href: "/our-story/about/source-to-you", note: "Source to You in Our Story > About doTERRA" }],
    watchFor: "Learn > Blog & Resources. Our Story > About doTERRA > Source to You. Shop. Search.",
    needBack: ["Click column (Essential Oils, Blog & Resources, Business), not only the link", "Source to You picks (it now has one home, in Our Story)", "Verbatim: what they expected on Certified Pure Testing Grade"],
  },
  {
    id: "T6", title: "Toddler safety", breakpoints: DESKTOP, reserve: false, highRisk: false, hypotheses: ["H3"],
    scenario: "You've started using oils at home and you're nervous about your toddler being around them. You'd like guidance on using them responsibly.",
    primary: [{ href: "/learn/essential-oils/essential-oil-safety" }], acceptable: [{ href: "/learn/essential-oils/how-to-use-essential-oils" }], separate: [],
    watchFor: "Learn > Blog & Resources > Healthy Living. Learn > Essential Oils > Product Training. Where people look now the Resources group is gone. Search.",
    needBack: ["Whether they open Essential Oils (where Essential Oil Safety now sits) or Blog & Resources first", "Verbatim on what they expected from Essential Oil Safety"],
  },
  {
    id: "T7", title: "Founders", breakpoints: ALL, reserve: false, highRisk: false, hypotheses: ["H4"],
    scenario: "Find out who started doTERRA and why.",
    primary: [{ href: "/our-story/about/founders" }], acceptable: [{ href: "/our-story/about/our-story" }],
    separate: [{ href: "/our-story/about/why-doterra", note: "Why doTERRA" }],
    watchFor: "Learn. Our Story > About doTERRA > Corporate. Search.",
    needBack: ["Median time to first interaction: the baseline across tasks", "If this task fails, pause analysis and check the scenario and the prototype before reading any other result"],
  },
  {
    id: "T8", title: "Charity", breakpoints: DESKTOP, reserve: false, highRisk: false, hypotheses: ["H4"],
    scenario: "You'd like to find out whether doTERRA does anything charitable or gives back to communities.",
    primary: [{ href: "/our-story/about/healing-hands-foundation" }], acceptable: [],
    separate: [{ href: "/our-story/about/why-doterra", note: "Why doTERRA" }, { href: "/our-story/about/source-to-you", note: "Source to You" }],
    watchFor: "Our Story > About doTERRA. Learn. Search.",
    needBack: ["Whether Why doTERRA or Source to You was tried first (they now sit beside Healing Hands Foundation in About doTERRA)"],
  },
  {
    id: "T9", title: "Savings", breakpoints: ALL, reserve: false, highRisk: true, hypotheses: ["H5", "H6"],
    scenario: "You buy the same oils every month and wonder if there is a way to pay less as a regular customer.",
    primary: [{ href: "/rewards/wholesale-membership" }],
    acceptable: [{ href: "/rewards/loyalty-rewards-program" }, { href: "/rewards/enrollment-options" }], separate: [],
    watchFor: "Shop > Collections & Enrollment. Shop > Highlights. Learn > Business. Search.",
    needBack: ["Which Rewards link, and why. After the click, ask what each of the three links means; do not explain them first", "Whether the dropdown opened without a prompt", "Member (WA, WC) and non-member results shown separately"],
  },
  {
    id: "T10", title: "Income", breakpoints: ALL, reserve: false, highRisk: true, hypotheses: ["H5"],
    scenario: "A friend mentioned they earn money selling doTERRA. Find out how you could do the same.",
    primary: [{ href: "/learn/business/business-opportunity" }], acceptable: [{ href: "/learn/business/path-to-500", note: "Confirm the page content first" }], separate: [],
    watchFor: "Rewards > Wholesale Membership or Enrollment Options. Learn > Business > Business Hub or Resources. Our Story. Search.",
    needBack: ["Whether the Business column was found", "Verbatim: what Path to $500 means to them. Do not explain it", "Member (WA, WC) and non-member results shown separately"],
  },
  {
    id: "T11", title: "Order problem", breakpoints: ALL, reserve: false, highRisk: false, hypotheses: ["H7"],
    scenario: "Something has gone wrong with an order you placed, and you'd like to speak to someone at doTERRA about it.",
    primary: [{ href: "/support/contact" }], acceptable: [],
    separate: [{ href: "/support/help", note: "Help: page content unconfirmed, it may cover getting in touch" }],
    watchFor: "Search. Rewards or Learn (account and membership readings). The bag or account icons. Scrolling to the footer: how long before they look there, and which Footer column (Support, or Our Story) they open first.",
    needBack: ["Whether they went to the footer without prompting, and how long they took to scroll there", "Which footer column they chose (Support, Rewards & Business, Our Story), not only the link", "Help versus Contact: which they picked, and why. Do not explain either"],
  },
  {
    id: "T12", title: "Sending back", breakpoints: ALL, reserve: false, highRisk: false, hypotheses: ["H7"],
    scenario: "You've received a product that isn't right for you. You'd like to know whether you can send it back, and how.",
    primary: [{ href: "/legal/returns-policy" }], acceptable: [],
    separate: [{ href: "/support/help", note: "Help: page content unconfirmed, it may cover returns" }],
    watchFor: "Search. Shop. Learn. Support in the footer (Help, Contact doTERRA) before the legal links at the very bottom.",
    needBack: ["Whether they found the legal links at the foot of the page, which are small and set apart from the footer columns", "If they chose Help or Contact doTERRA, verbatim: what they expected to find there", "Whether the word policy was something they were looking for"],
  },
  {
    id: "R1", title: "Convention", breakpoints: DESKTOP, reserve: true, highRisk: false, hypotheses: ["H4"],
    scenario: "You've heard doTERRA holds a big annual gathering for its community. Find out about the next one.",
    primary: [{ href: "/our-story/events/convention" }], acceptable: [], separate: [],
    watchFor: "Learn. Rewards. Our Story > About doTERRA. Search.",
    needBack: ["Run only if time allows: a findability baseline. Events placement is an operational decision, not a sort result"],
  },
  {
    id: "R2", title: "Healthy living", breakpoints: DESKTOP, reserve: true, highRisk: false, hypotheses: ["H3"],
    scenario: "You're not shopping for anything in particular. You'd like some general ideas for looking after your wellbeing day to day.",
    primary: [{ href: "/learn/blog/healthy-living" }], acceptable: [], separate: [],
    watchFor: "Shop. Learn > Essential Oils > What Are Essential Oils. Search.",
    needBack: ["Where they look first: Shop, Learn > Essential Oils or Learn > Blog & Resources. Healthy Living now has one home"],
  },
];

export const DEFAULT_CONTENT: Content = {
  schemaVersion: 1,
  // Version 2: the post-card-sort IA (Arm R), matching the tree test. Version 1 targeted the earlier navigation.
  // Version 3: adds T11 and T12, the two footer tasks.
  version: 3,
  updatedAt: "2026-10-15T00:00:00.000Z",
  tasks: DEFAULT_TASKS,
};
