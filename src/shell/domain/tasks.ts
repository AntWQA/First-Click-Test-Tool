import type { Breakpoint } from "../../shared/protocol.ts";

/** nav: scored on the link the participant chose (two levels). click: scored on the first click, by where on the page it landed. observe: nothing is scored; what the participant says and does is coded afterwards. */
export type TaskKind = "nav" | "click" | "observe";
/** The three parts of the combined session, in the order they run. */
export type Block = "homepage" | "product" | "navigation";
/** How a participant reaches the product page. Set from the participant number, so each route is seen equally. */
export type Arrival = "homepage" | "google" | "shared";
export const ARRIVALS: Arrival[] = ["homepage", "google", "shared"];
export const ARRIVAL_LABELS: Record<Arrival, string> = { homepage: "Homepage (warm, browsed)", google: "Google result (cold)", shared: "Shared link (warm)" };

/** One answer. A nav task points at a link (href). A click task points at a part of the page (zone), or at a header route (nav-learn) or the footer. */
export interface TargetSpec {
  href?: string;
  zone?: string;
  note?: string;
}

/** A question the moderator codes after the task, from a short list agreed before fieldwork. */
export interface CodeSpec {
  id: string;
  label: string;
  options: string[];
}

interface TaskExtras {
  kind: TaskKind;
  block: Block;
  /** The time allowed for this task in the run of show, in minutes. */
  minutes: number;
  /** The page this task starts on (a path). The homepage unless the task says otherwise. */
  start: string;
  /** Asked in order after the scenario. They show under the scenario on screen, so a participant can answer aloud (or in the notes box when nobody is there). */
  questions: string[];
  /** Lines added before the scenario for the route the participant arrived by. Null for tasks with no arrival. */
  leadIns: Record<Arrival, string> | null;
  /** The answers the moderator codes, one choice each. */
  codes: CodeSpec[];
  /** When set, the participant also rates this 1 to 7 after the task (a confidence question). */
  confidence: string;
  /** Replaces the question above the notes box. */
  notesPrompt: string;
  /** The id of a task that must not sit next to this one (the two probe each other's wording). */
  apartFrom: string;
  /** True when the first header or menu use in this task is read for "do the menus open unaided". */
  readsMenu: boolean;
}

export interface Task extends TaskExtras {
  id: string;
  title: string;
  /** Read to the participant. */
  scenario: string;
  /** Breakpoints this task runs at. A session at a breakpoint skips tasks that do not list it. */
  breakpoints: Breakpoint[];
  reserve: boolean;
  highRisk: boolean;
  hypotheses: string[];
  /** The intended path. Empty for an observe task. */
  primary: TargetSpec[];
  /** A reasonable alternative, agreed before fieldwork. */
  acceptable: TargetSpec[];
  /** Plausible answers recorded on their own, never scored as a miss or a hit. */
  separate: TargetSpec[];
  watchFor: string;
  needBack: string[];
}

/** A task written without the combined-test fields: they take these defaults (a navigation task starting on the homepage). */
export type TaskInput = Omit<Task, keyof TaskExtras> & Partial<TaskExtras>;
export const TASK_DEFAULTS: TaskExtras = { kind: "nav", block: "navigation", minutes: 3, start: "/", questions: [], leadIns: null, codes: [], confidence: "", notesPrompt: "", apartFrom: "", readsMenu: false };
export const mk = (t: TaskInput): Task => ({ ...TASK_DEFAULTS, ...t });

export interface Content {
  schemaVersion: 1;
  version: number;
  updatedAt: string;
  tasks: Task[];
  /** True when each participant uses one device (desktop or mobile, by participant number) for the whole session, instead of a device per task. */
  devicePerParticipant?: boolean;
  /** Questions and steps for the debrief, shown to the moderator. */
  debrief?: string[];
}

const ALL: Breakpoint[] = ["desktop", "tablet", "mobile"];
const DESKTOP: Breakpoint[] = ["desktop"];

const NAVIGATION_TASK_INPUTS: TaskInput[] = [
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

export const NAVIGATION_TASKS: Task[] = NAVIGATION_TASK_INPUTS.map(mk);

/** The navigation-only test (12 core tasks, 2 reserve, one breakpoint per task). Kept as a preset: the unit and end-to-end tests use it, and the Content tab can load it. */
export const NAVIGATION_CONTENT: Content = {
  schemaVersion: 1,
  // Version 2: the post-card-sort IA (Arm R), matching the tree test. Version 1 targeted the earlier navigation.
  // Version 3: adds T11 and T12, the two footer tasks.
  version: 3,
  updatedAt: "2026-10-15T00:00:00.000Z",
  tasks: NAVIGATION_TASKS,
};

// ---------------------------------------------------------------------------------------------------------------------
// The combined test: homepage, product page and navigation in one session of no more than 50 minutes (44 core, up to 4 for
// reserves, 2 spare). Task ids, wording, allowances and hypotheses (CH1 to CH13) come from the "Combined test" plan in Figma.
// C1 to C3 (homepage) and C4 to C7 (product page) run in this order; C8 to C11 (navigation) run in a seeded order with Sleep and
// Cough never adjacent. Reserves are offered to the participant only if time allows.
// ---------------------------------------------------------------------------------------------------------------------

const BOTH: Breakpoint[] = ["desktop", "mobile"];
const PRODUCT_A = "/shop/products/lavender-essential-oil";
const PRODUCT_B = "/shop/products/pb-restore";

const fromNavigation = (oldId: string, id: string, extra: Partial<Task>): Task => {
  const base = NAVIGATION_TASK_INPUTS.find((t) => t.id === oldId);
  if (!base) throw new Error("no navigation task " + oldId);
  return mk({ ...base, id, breakpoints: BOTH, minutes: 2.75, block: "navigation", hypotheses: [], ...extra });
};

/** The two products the product page tasks use, named in full: a scenario is read before the page is on screen, so it cannot say "this" or "these". */
const PRODUCT_A_NAME = "dōTERRA Lavender essential oil";
const PRODUCT_B_NAME = "PB Restore";
const CONFIDENCE_QUALITY = "How confident are you that the products dōTERRA sells are safe and high quality?";
const confidenceBuy = (product: string) => `How sure are you about buying ${product}?`;
const YES_NO = ["Yes", "No"];
const ICON_CODES = ["Correct", "Partial", "Wrong", "Cannot say"];

export const COMBINED_TASKS: Task[] = [
  mk({
    id: "C1", title: "First view", kind: "observe", block: "homepage", minutes: 3.5, breakpoints: BOTH, reserve: false, highRisk: true, hypotheses: ["CH1", "CH3", "CH9"],
    scenario: "You have just arrived on the homepage of the dōTERRA website. Before you scroll or click, tell me what you notice and what you think dōTERRA sells.",
    questions: ["What does dōTERRA sell?", "Who are its products for?", "What makes dōTERRA different from other places you could buy the same kind of products?"],
    confidence: CONFIDENCE_QUALITY,
    notesPrompt: "Your answers to the three questions, in your own words.",
    primary: [], acceptable: [], separate: [],
    codes: [
      { id: "sells", label: "What it sells", options: ["Correct", "Partial", "Not clear"] },
      { id: "different", label: "What makes it different", options: ["Testing or purity", "Sourcing", "Plant-based", "Offer or price", "Generic", "Nothing"] },
    ],
    watchFor: "Thinks it sells medicine, food or something else. \"I don't know.\" Reads the promo banner as the headline. Existing customers: question 2 becomes \"What would you do first here, and is anything missing that you would expect?\" Code and report them apart.",
    needBack: ["Spoken answers, word for word, and their codes", "Confidence 1 to 7 (the first reading for CH3)", "What they looked at before speaking (observed)", "Any doubt moment, with its zone"],
  }),
  mk({
    id: "C2", title: "Looking for proof", kind: "click", block: "homepage", minutes: 3, breakpoints: BOTH, reserve: false, highRisk: false, hypotheses: ["CH2", "CH3", "CH9"],
    scenario: "A friend mentioned doTERRA and you are thinking about trying an essential oil for the first time. Before you buy anything, find what would help you decide whether you can trust what is in dōTERRA's essential oil bottles.",
    confidence: CONFIDENCE_QUALITY,
    primary: [{ zone: "quality", note: "The quality block, or a link to it (How we test, How we source and test)" }],
    acceptable: [{ zone: "why-value-cards", note: "Why dōTERRA value cards: Sourced at origin, Tested for purity" }, { zone: "nav-learn", note: "Header > Learn > Essential Oils > Certified Pure Testing Grade, a route off the page" }],
    separate: [],
    codes: [{ id: "noRatings", label: "Noticed there are no ratings or reviews, unprompted", options: ["Yes, unprompted", "Only when asked", "No"] }],
    watchFor: "Product cards, looking for ratings. FAQ. Offers. Search. Scrolls the whole page, then leaves for the header. Looks for stars or a review count and says there are none.",
    needBack: ["First click and its zone (scored)", "Confidence 1 to 7 after reading, set against C1", "What the content told them and what it did not", "Unprompted reaction to a page with no ratings or reviews", "Doubt log entries"],
  }),
  mk({
    id: "C3", title: "First product", kind: "observe", block: "homepage", minutes: 3, breakpoints: BOTH, reserve: false, highRisk: false, hypotheses: ["CH4", "CH9"], readsMenu: true,
    scenario: "You have decided to try dōTERRA for the first time and want to choose something to buy. Show me what you would do, starting from the homepage, and what you would do next.",
    notesPrompt: "Which product would you choose, and why?",
    primary: [], acceptable: [], separate: [],
    codes: [
      { id: "route", label: "First route", options: ["Hero Shop best sellers", "Best sellers carousel", "Category carousel", "Header Shop menu", "Search", "Offers", "Other"] },
      { id: "action", label: "First action on a product", options: ["Open the product page", "Add to bag", "Other", "Not reached"] },
    ],
    watchFor: "Scrolls the whole page, then leaves for the header. Looks for filters, ratings or a quiz. Opens Offers first because it is the largest block. Picks on price alone. Opens a header menu without being prompted (also read for navigation H6). Add to bag is not built on the cards yet, so the add step cannot happen.",
    needBack: ["First meaningful action, and its route code", "The order of every route tried", "First action on a product, and why, in their words", "On mobile: whether the carousel was moved (observed)", "Whether a header menu opened unprompted"],
  }),
  mk({
    id: "C4", title: "First view and icons", kind: "observe", block: "product", minutes: 4, start: PRODUCT_A, breakpoints: BOTH, reserve: false, highRisk: false, hypotheses: ["CH5", "CH6", "CH7", "CH9"],
    leadIns: {
      homepage: `You opened the ${PRODUCT_A_NAME} page from the best sellers on the dōTERRA homepage.`,
      google: "You searched for lavender essential oil and opened the dōTERRA result.",
      shared: `A friend sent you a link to the ${PRODUCT_A_NAME} page and said: "Lavender is the one I use."`,
    },
    scenario: `Before you scroll, tell me what you think ${PRODUCT_A_NAME} is for, whether it would suit you if you wanted something to help you wind down in the evening, and how you would use it.`,
    questions: ["Then, pointing at the usage icons on the page: tell me what each icon means."],
    notesPrompt: `What is ${PRODUCT_A_NAME} for, would it suit you, and how would you use it? What do the usage icons mean?`,
    primary: [], acceptable: [], separate: [],
    codes: [
      { id: "purpose", label: "What it is for", options: ["Correct", "Partial", "Not clear", "Wrong"] },
      { id: "suits", label: "Whether it suits the concern", options: ["Yes, with a reason from the page", "Yes, without a reason", "No", "Cannot say"] },
      { id: "howTo", label: "How to use it", options: ["Names a way", "Does not"] },
      { id: "iconAromatic", label: "Icon: aromatically", options: ICON_CODES },
      { id: "iconTopical", label: "Icon: topically", options: ICON_CODES },
      { id: "iconNeat", label: "Icon: no dilution (neat)", options: ICON_CODES },
      { id: "iconHelp", label: "Hovered or tapped an icon for help", options: YES_NO },
    ],
    watchFor: "Thinks it is a supplement or a food. Reads a badge (Best seller, 25% off) as the product claim. Cannot say anything about use. Hovers or taps an icon for help (counted as help). Scrolls before answering. The Google and shared link routes are text only for now: the page opens directly, with no search results or message mock-up.",
    needBack: ["Spoken answers and codes: purpose, suits, how to use, and each icon", "Arrival route, device and customer type", "What they looked at before answering", "Time to first answer", "Doubt log entries, with seconds since arrival"],
  }),
  mk({
    id: "C5", title: "What makes you sure", kind: "observe", block: "product", minutes: 3, start: PRODUCT_A, breakpoints: BOTH, reserve: false, highRisk: false, hypotheses: ["CH8", "CH9"],
    scenario: `You are thinking about buying ${PRODUCT_A_NAME}. Have a look around its page and tell me, out loud, anything that makes you more sure or less sure.`,
    confidence: confidenceBuy(PRODUCT_A_NAME),
    notesPrompt: "What made you more sure, and what made you less sure?",
    primary: [], acceptable: [], separate: [],
    codes: [
      { id: "firstSignal", label: "First signal they used", options: ["Reviews", "Rating", "CPTG badge", "Description or Things to know", "Sourcing story", "Recommended products", "None"] },
      { id: "leftPage", label: "Left the page to check elsewhere", options: YES_NO },
    ],
    watchFor: "Scrolls to the reviews and does not read them. Says they would search elsewhere to check. Leaves the page to compare, which is a doubt moment. Skips the CPTG badge. Reads repeated review text as fake. The reviews are prototype stand-ins.",
    needBack: ["Signals touched, in order, with the words used", "Unprompted doubt, logged with its zone and seconds since arrival", "Confidence 1 to 7 at the end", "Whether they left the page to check elsewhere"],
  }),
  mk({
    id: "C6", title: "What would I pay", kind: "click", block: "product", minutes: 2.5, start: PRODUCT_A, breakpoints: BOTH, reserve: false, highRisk: true, hypotheses: ["CH10"],
    scenario: `You decide to buy one bottle of ${PRODUCT_A_NAME} and have it delivered to your home. Without leaving its page, tell me what you would pay in total.`,
    notesPrompt: "What would you pay in total, and how did you work it out?",
    primary: [{ zone: "shipping", note: "Opens the Shipping options overlay from the shipping line" }], acceptable: [], separate: [],
    codes: [
      { id: "total", label: "Total cost", options: ["Correct", "Price only", "Wrong", "Gave up"] },
      { id: "freeMisread", label: "Read the free shipping line as applying to them", options: YES_NO },
    ],
    watchFor: "Says shipping is free (reads the loyalty line as applying to them). Gives the item price only. Adds to cart to find out. Leaves for the footer or Help. Cannot say. A correct total from the shipping line alone has no click: set the tier to Acceptable. Answer key: the item price plus the delivery cost for the method they choose, from the Shipping options table as built (Lavender $38.67, Economy $6.99).",
    needBack: ["Spoken total, coded: Correct, Price only, Wrong, Gave up", "Path: opened Shipping options, scrolled, left the page", "Time to answer", "Whether they read the free shipping line as applying to them"],
  }),
  mk({
    id: "C7", title: "Two ways to buy, and choose", kind: "click", block: "product", minutes: 4, start: PRODUCT_A, breakpoints: BOTH, reserve: false, highRisk: true, hypotheses: ["CH11"],
    scenario: `There is more than one way to buy ${PRODUCT_A_NAME} on its page. Tell me what you think each way is and how they differ. What would you have to do to get the lower price, and how much would you save?`,
    questions: [`Then decide which way you would buy ${PRODUCT_A_NAME}, get it ready to buy, and tell me how sure you feel.`],
    confidence: "How sure are you about your choice?",
    notesPrompt: "What is each way to buy, how do they differ, and which would you choose?",
    primary: [{ zone: "option-account", note: "Selects the account option to see its price" }, { zone: "add-to-cart", note: "Add item to cart, with their chosen option selected" }],
    acceptable: [{ zone: "quantity", note: "Changes the quantity first, then adds" }],
    separate: [{ zone: "option-one-time", note: "Either option is a valid choice; the choice is recorded" }],
    codes: [
      { id: "whatItIs", label: "Says what the lower price is (a lower price for account holders)", options: YES_NO },
      { id: "howToGet", label: "Says how to get it (create an account)", options: YES_NO },
      { id: "costToJoin", label: "Says whether it costs anything to join", options: ["Correct", "Wrong", "Not mentioned"] },
      { id: "saving", label: "Says the saving", options: ["Correct", "Wrong", "Not mentioned"] },
      { id: "choice", label: "Option chosen", options: ["One time purchase", "Create an account and save", "Neither"] },
    ],
    watchFor: "Thinks the lower price is a sale or a coupon. Thinks it needs a subscription or a bigger order. Ignores the account option. Adds before choosing, taking the default without noticing. Cannot find the button. Looks for Buy now. Leaves to compare.",
    needBack: ["Click on the account option (scored)", "Spoken answer, coded on the four elements", "Option chosen, and the Add item to cart click (scored)", "Confidence 1 to 7, and their reason", "Hesitation on the button, 5 seconds or more"],
  }),
  fromNavigation("T1", "C8", { hypotheses: ["CH12"] }),
  fromNavigation("T2", "C9", { hypotheses: ["CH12"], apartFrom: "C8" }),
  fromNavigation("T9", "C10", { hypotheses: ["CH13"] }),
  fromNavigation("T10", "C11", { hypotheses: ["CH13"], acceptable: [{ href: "/learn/business/path-to-500" }] }),
  mk({
    id: "R1", title: "Reserve: best sellers", kind: "observe", block: "homepage", minutes: 1.5, breakpoints: ["mobile"], reserve: true, highRisk: false, hypotheses: ["CH4"],
    scenario: "You would like to see which dōTERRA products other people buy most. Look through those products and tell me which two you would look at first.",
    notesPrompt: "Which two would you look at first?",
    primary: [], acceptable: [], separate: [],
    codes: [{ id: "moved", label: "Moved the carousel to see a product that was not in view", options: ["Arrow", "Swipe or drag", "Page scroll", "Did not move it"] }],
    watchFor: "Taps a product card instead of moving the carousel. Taps the arrow and misses. Says there is only one product. Looks for dots. Mobile only: at desktop all five best sellers are in view.",
    needBack: ["Reached a product that was not in view, yes or no, and how", "Time to first movement", "Dead taps, with coordinates"],
  }),
  mk({
    id: "R2", title: "Reserve: no reviews yet", kind: "observe", block: "product", minutes: 2.5, start: PRODUCT_B, breakpoints: BOTH, reserve: true, highRisk: false, hypotheses: ["CH9"],
    scenario: `Here is the page for ${PRODUCT_B_NAME}, a newer probiotic supplement from dōTERRA. You are thinking of buying ${PRODUCT_B_NAME}. Tell me what you think.`,
    confidence: confidenceBuy(PRODUCT_B_NAME),
    notesPrompt: `What do you think of ${PRODUCT_B_NAME}, and would you buy it?`,
    primary: [], acceptable: [], separate: [],
    codes: [
      { id: "noticed", label: "Noticed there are no reviews", options: ["Unprompted, before any question", "Only when asked", "Not noticed"] },
      { id: "wouldBuy", label: "Would buy", options: ["Yes", "No", "Only if"] },
    ],
    watchFor: "Does not notice. Reads it as the site hiding reviews. Reads it as a good sign (new, exclusive). Asks whether it is safe. Goes back to Product A to compare. If this does not run, the debrief asks the question instead.",
    needBack: ["Whether and when they mention the missing reviews unprompted, before any question", "Then asked: what, if anything, is missing?", "Confidence 1 to 7, set against Product A", "What they say they would use instead"],
  }),
];

export const COMBINED_DEBRIEF: string[] = [
  "Show the video version of the gallery once. Ask: \"Would seeing a video in the gallery have made a difference to how sure you felt? To what?\"",
  "Rank four cards, most sure to least sure: reviews, CPTG, sourcing story, video.",
  "If R2 did not run, ask: \"If a product you were thinking of buying had no reviews yet, what would you do?\"",
  "What did each Rewards link mean to them (C10), and what did Solutions mean (C8, C9)?",
  "What would they change first on the homepage and on the product page?",
  "Thank them. These are spoken opinions: read them beside what people did.",
];

export const DEFAULT_TASKS: Task[] = COMBINED_TASKS;

export const DEFAULT_CONTENT: Content = {
  schemaVersion: 1,
  // Version 4: the combined test (homepage, product page and navigation in one session of 50 minutes or less). Versions 1 to 3 were the navigation-only test, kept as NAVIGATION_CONTENT.
  // Version 5: every scenario names the product instead of saying "this" or "these".
  version: 5,
  updatedAt: "2026-10-22T00:00:00.000Z",
  tasks: COMBINED_TASKS,
  devicePerParticipant: true,
  debrief: COMBINED_DEBRIEF,
};
