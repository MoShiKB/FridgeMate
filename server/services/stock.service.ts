/**
 * The AI is only asked for stable, item-level facts (how much a package holds,
 * how fast a person gets through it). Everything else is plain arithmetic here,
 * so results are reproducible and can be recalculated for free whenever the
 * household size changes.
 */

/**
 * Flag an item once the household has fewer than this many days left. Kept tight
 * on purpose: in a 6-person fridge almost every fresh item lasts under a week, so
 * a looser threshold flags most of the inventory and stops meaning anything.
 */
export const LOW_STOCK_DAYS = 2;

/** A restock proposal buys enough for this many days — roughly one grocery run. */
export const RESTOCK_TARGET_DAYS = 7;

export interface ConsumptionProfile {
  /** Servings in one individual piece (one egg, one apple). */
  pieceServings: number;
  /** Servings in one retail package (bottle, jar, carton, tub...). */
  packageServings: number;
  gramsPerServing: number;
  mlPerServing: number;
  /** Servings one person gets through per week. 0 means "not consumed". */
  servingsPerPersonPerWeek: number;
}

export interface StockAssessment {
  isRunningLow: boolean;
  daysOfSupply: number | null;
  suggestedRestockQuantity: string | null;
  lowStockReason: string | null;
}

export const NO_ASSESSMENT: StockAssessment = {
  isRunningLow: false,
  daysOfSupply: null,
  suggestedRestockQuantity: null,
  lowStockReason: null,
};

type QuantityKind = "piece" | "package" | "mass" | "volume";

export interface ParsedQuantity {
  amount: number;
  kind: QuantityKind;
  /** Singular unit word as written by the user. Empty for bare counts. */
  unit: string;
}

const MASS_TO_GRAMS: Record<string, number> = {
  g: 1, gr: 1, gram: 1, gramme: 1,
  kg: 1000, kilo: 1000, kilogram: 1000, kilogramme: 1000,
  mg: 0.001,
  lb: 453.592, pound: 453.592,
  oz: 28.3495, ounce: 28.3495,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1, milliliter: 1, millilitre: 1, cc: 1,
  cl: 10, dl: 100,
  l: 1000, liter: 1000, litre: 1000,
  gallon: 3785.41, pint: 473.176, quart: 946.353,
  "fl oz": 29.5735,
};

const PIECE_UNITS = new Set([
  "", "pc", "pcs", "piece", "unit", "item", "x", "ea", "each",
  "left", "remaining", "count", "whole", "individual",
]);

const PACKAGE_UNITS = new Set([
  "bottle", "jar", "carton", "can", "container", "bag", "box", "loaf", "head",
  "bunch", "tub", "pack", "package", "packet", "block", "cup", "basket", "jug",
  "tube", "bulb", "roll", "stick", "tray", "punnet", "sleeve", "sachet", "pot",
  "tin", "bar", "portion", "serving", "bowl", "plate", "batch", "cluster",
  "stalk", "sprig", "slice", "clove", "wedge", "fillet", "bundle", "case",
  "crate", "pile", "handful", "scoop", "cube", "ball", "log", "wheel", "sheet",
]);

/**
 * Containers worth inferring from an item's name. Deliberately excludes portion
 * words like "slice" or "clove" that are also in PACKAGE_UNITS — those describe
 * a helping rather than something the item is sold in.
 */
const NAME_CONTAINERS = new Set([
  "bottle", "jar", "carton", "can", "container", "bag", "box", "tub", "pack",
  "package", "packet", "jug", "tube", "tin", "crate", "case", "sachet", "pot",
  "tray", "punnet", "basket", "loaf", "bunch", "block",
]);

const WORD_AMOUNTS: Record<string, number> = {
  a: 1, an: 1, one: 1, single: 1,
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, dozen: 12,
  half: 0.5, quarter: 0.25, third: 1 / 3,
  couple: 2, pair: 2, few: 3, several: 4,
};

/** The scan prompt forbids these, but hand-entered quantities still contain them. */
const HEDGE_PREFIX =
  /^(?:about|approximately|approx|around|roughly|circa|ca\.?|~|more or less|plus or minus)\s+/;

/** Vague descriptors, as a fraction of a package. */
const FUZZY_AMOUNTS: Array<[RegExp, number]> = [
  [/\bempty\b/, 0],
  [/\b(almost|nearly)\s+empty\b/, 0.15],
  [/\bsmall\s+(pile|amount|handful)\b/, 0.3],
  [/\bhandful\b/, 0.3],
  [/\bpartial\b/, 0.4],
  [/\bpile\b/, 0.5],
  [/\bhalf\b/, 0.5],
  [/\b(little|bit)\b/, 0.25],
  [/\bfull\b/, 1],
];

const FILLER_WORDS = new Set([
  "of", "a", "an", "the", "about", "approx", "approximately", "around",
  "roughly", "some", "more", "or", "so", "and", "full", "new", "large",
  "small", "medium", "big", "mini", "standard", "regular",
]);

function singularize(word: string): string {
  if (!word || PACKAGE_UNITS.has(word) || PIECE_UNITS.has(word)) return word;
  if (word in MASS_TO_GRAMS || word in VOLUME_TO_ML) return word;

  const irregular: Record<string, string> = {
    loaves: "loaf",
    leaves: "leaf",
    halves: "half",
    boxes: "box",
    bunches: "bunch",
    dishes: "dish",
    sandwiches: "sandwich",
    feet: "foot",
  };
  if (word in irregular) return irregular[word];

  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ses") || word.endsWith("xes") || word.endsWith("ches")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function pluralize(word: string, count: number): string {
  if (count === 1 || !word) return word;
  if (word.endsWith("f")) return `${word.slice(0, -1)}ves`;
  if (/(s|x|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

function classifyUnit(unit: string): QuantityKind {
  if (unit in MASS_TO_GRAMS) return "mass";
  if (unit in VOLUME_TO_ML) return "volume";
  if (PIECE_UNITS.has(unit)) return "piece";
  // Unknown words are far more likely to be a container than a loose count.
  return "package";
}

/**
 * Scanned items often put the container in the name ("ketchup bottle") and leave
 * the quantity a bare "1". Without this the bottle would score as a single
 * serving instead of a full package.
 */
function containerFromName(itemName: string): string {
  const words = String(itemName ?? "").toLowerCase().split(/[^a-z]+/);
  for (const word of words) {
    const singular = singularize(word);
    if (NAME_CONTAINERS.has(singular)) return singular;
  }
  return "";
}

/** "1 carton", "500g", "2 left", "half a block" -> a number plus a usable unit. */
export function parseQuantity(raw: string, itemName = ""): ParsedQuantity {
  const text = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[,]/g, "")
    .replace(HEDGE_PREFIX, "");
  if (!text) return { amount: 1, kind: "package", unit: containerFromName(itemName) };

  let amount: number | null = null;
  let rest = text;

  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  const decimal = text.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);

  if (fraction && Number(fraction[2]) !== 0) {
    amount = Number(fraction[1]) / Number(fraction[2]);
    rest = fraction[3];
  } else if (decimal) {
    amount = Number(decimal[1]);
    rest = decimal[2];
  } else {
    const firstWord = text.split(/\s+/)[0];
    if (firstWord in WORD_AMOUNTS) {
      amount = WORD_AMOUNTS[firstWord];
      rest = text.slice(firstWord.length).trim();
    }
  }

  if (amount === null) {
    // A phrase with no number at all ("small pile") is a part-package.
    const fuzzy = FUZZY_AMOUNTS.find(([pattern]) => pattern.test(text));
    return {
      amount: fuzzy ? fuzzy[1] : 1,
      kind: "package",
      unit: extractUnit(text) || containerFromName(itemName),
    };
  }

  const unit = extractUnit(rest);
  if (!unit) {
    const container = containerFromName(itemName);
    if (container) return { amount, kind: "package", unit: container };
  }
  return { amount, kind: classifyUnit(unit), unit };
}

function extractUnit(rest: string): string {
  const words = rest
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z]/g, ""))
    .filter((w) => w && !FILLER_WORDS.has(w));

  for (const word of words) {
    const singular = singularize(word);
    if (
      singular in MASS_TO_GRAMS ||
      singular in VOLUME_TO_ML ||
      PACKAGE_UNITS.has(singular) ||
      PIECE_UNITS.has(singular)
    ) {
      return singular;
    }
  }
  return words.length > 0 ? singularize(words[0]) : "";
}

export function toServings(parsed: ParsedQuantity, profile: ConsumptionProfile): number {
  switch (parsed.kind) {
    case "mass":
      return (parsed.amount * (MASS_TO_GRAMS[parsed.unit] ?? 1)) /
        Math.max(profile.gramsPerServing, 1);
    case "volume":
      return (parsed.amount * (VOLUME_TO_ML[parsed.unit] ?? 1)) /
        Math.max(profile.mlPerServing, 1);
    case "piece":
      return parsed.amount * Math.max(profile.pieceServings, 0);
    case "package":
      return parsed.amount * Math.max(profile.packageServings, 0);
  }
}

function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/** Expresses a serving deficit back in the unit the user already uses for this item. */
function formatRestock(
  deficitServings: number,
  parsed: ParsedQuantity,
  profile: ConsumptionProfile
): string | null {
  if (deficitServings <= 0) return null;

  switch (parsed.kind) {
    case "mass": {
      const grams = deficitServings * Math.max(profile.gramsPerServing, 1);
      return grams >= 1000
        ? `${roundUpTo(grams / 1000, 0.5)}kg`
        : `${roundUpTo(grams, 50)}g`;
    }
    case "volume": {
      const ml = deficitServings * Math.max(profile.mlPerServing, 1);
      if (ml < 1000) return `${roundUpTo(ml, 50)}ml`;
      const liters = roundUpTo(ml / 1000, 0.5);
      return `${liters} ${pluralize("liter", liters)}`;
    }
    case "piece": {
      const pieces = Math.ceil(deficitServings / Math.max(profile.pieceServings, 0.01));
      return `${pieces} more`;
    }
    case "package": {
      const packs = Math.ceil(deficitServings / Math.max(profile.packageServings, 0.01));
      const unit = parsed.unit || "pack";
      return `${packs} ${pluralize(unit, packs)}`;
    }
  }
}

function formatReason(daysOfSupply: number, householdSize: number): string {
  const people = `${householdSize} ${householdSize === 1 ? "person" : "people"}`;
  if (daysOfSupply < 1) return `Less than a day left for ${people}`;
  const days = Math.round(daysOfSupply);
  return `About ${days} ${days === 1 ? "day" : "days"} left for ${people}`;
}

export class StockService {
  static assess(
    quantity: string,
    householdSize: number,
    profile: ConsumptionProfile | undefined,
    itemName = ""
  ): StockAssessment {
    if (!profile) return NO_ASSESSMENT;

    const people = Math.max(1, householdSize);
    const dailyDemand = (profile.servingsPerPersonPerWeek * people) / 7;

    // Condiments, spices and anything the household doesn't actually work
    // through (empty containers, cookware) never run low.
    if (!Number.isFinite(dailyDemand) || dailyDemand <= 0) return NO_ASSESSMENT;

    const parsed = parseQuantity(quantity, itemName);
    const totalServings = toServings(parsed, profile);
    if (!Number.isFinite(totalServings)) return NO_ASSESSMENT;

    const daysOfSupply = totalServings / dailyDemand;
    const isRunningLow = daysOfSupply < LOW_STOCK_DAYS;

    if (!isRunningLow) {
      return {
        isRunningLow: false,
        daysOfSupply: Math.round(daysOfSupply * 10) / 10,
        suggestedRestockQuantity: null,
        lowStockReason: null,
      };
    }

    const deficit = dailyDemand * RESTOCK_TARGET_DAYS - totalServings;
    return {
      isRunningLow: true,
      daysOfSupply: Math.round(daysOfSupply * 10) / 10,
      suggestedRestockQuantity: formatRestock(deficit, parsed, profile),
      lowStockReason: formatReason(daysOfSupply, people),
    };
  }
}
