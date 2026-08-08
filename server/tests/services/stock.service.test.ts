import {
    StockService,
    parseQuantity,
    ConsumptionProfile,
    LOW_STOCK_DAYS,
} from "../../services/stock.service";

const MILK: ConsumptionProfile = {
    pieceServings: 1,
    packageServings: 8,
    gramsPerServing: 250,
    mlPerServing: 250,
    servingsPerPersonPerWeek: 4,
};

const KETCHUP: ConsumptionProfile = {
    pieceServings: 1,
    packageServings: 30,
    gramsPerServing: 15,
    mlPerServing: 15,
    servingsPerPersonPerWeek: 0.5,
};

const EGGS: ConsumptionProfile = {
    pieceServings: 1,
    packageServings: 12,
    gramsPerServing: 60,
    mlPerServing: 60,
    servingsPerPersonPerWeek: 3,
};

const CHICKEN: ConsumptionProfile = {
    pieceServings: 2,
    packageServings: 4,
    gramsPerServing: 150,
    mlPerServing: 150,
    servingsPerPersonPerWeek: 2,
};

const JUICE: ConsumptionProfile = {
    pieceServings: 1,
    packageServings: 4,
    gramsPerServing: 250,
    mlPerServing: 250,
    servingsPerPersonPerWeek: 3,
};

/** Not food — an unidentified container the scanner picked up. */
const NOT_CONSUMED: ConsumptionProfile = {
    pieceServings: 1,
    packageServings: 1,
    gramsPerServing: 100,
    mlPerServing: 100,
    servingsPerPersonPerWeek: 0,
};

describe("parseQuantity", () => {
    it.each([
        ["1 carton", 1, "package", "carton"],
        ["2 bottles", 2, "package", "bottle"],
        ["4 containers", 4, "package", "container"],
        ["1 head", 1, "package", "head"],
        ["1 loaf", 1, "package", "loaf"],
        ["3 cups", 3, "package", "cup"],
        ["500g", 500, "mass", "g"],
        ["1.5 kg", 1.5, "mass", "kg"],
        ["750ml", 750, "volume", "ml"],
        ["1 liter", 1, "volume", "liter"],
        ["6", 6, "piece", ""],
        ["3 pcs", 3, "piece", "pcs"],
        ["2 left", 2, "piece", "left"],
        ["1/2 jar", 0.5, "package", "jar"],
        ["half a block", 0.5, "package", "block"],
    ])("parses %s", (raw, amount, kind, unit) => {
        expect(parseQuantity(raw as string)).toEqual({ amount, kind, unit });
    });

    it("treats a vague descriptor as a part-package", () => {
        const parsed = parseQuantity("small pile");
        expect(parsed.kind).toBe("package");
        expect(parsed.amount).toBeGreaterThan(0);
        expect(parsed.amount).toBeLessThan(1);
    });

    it("falls back to one package for an empty quantity", () => {
        expect(parseQuantity("")).toEqual({ amount: 1, kind: "package", unit: "" });
    });

    it("ignores hedging words around the number", () => {
        expect(parseQuantity("about 2 bottles")).toMatchObject({ amount: 2, unit: "bottle" });
    });

    it.each([
        ["ketchup bottle", "bottle"],
        ["bottle of ketchup", "bottle"],
        ["cracker box", "box"],
        ["small clear container with food", "container"],
        ["jar of white spread", "jar"],
    ])("reads the container out of %s when the quantity is a bare count", (name, unit) => {
        expect(parseQuantity("1", name)).toEqual({ amount: 1, kind: "package", unit });
    });

    it("leaves a bare count alone when the name has no container", () => {
        expect(parseQuantity("6", "egg")).toEqual({ amount: 6, kind: "piece", unit: "" });
    });

    it("prefers a unit written in the quantity over one in the name", () => {
        expect(parseQuantity("500g", "cheese block")).toMatchObject({ kind: "mass", unit: "g" });
    });

    it("ignores portion words in the name, which are not containers", () => {
        expect(parseQuantity("3", "cheese slice")).toMatchObject({ kind: "piece" });
    });
});

describe("StockService.assess", () => {
    it("flags half a carton of milk as low for a 6-person household", () => {
        const result = StockService.assess("1/2 carton", 6, MILK);

        expect(result.isRunningLow).toBe(true);
        expect(result.daysOfSupply).toBeLessThan(LOW_STOCK_DAYS);
        expect(result.suggestedRestockQuantity).toBe("3 cartons");
        expect(result.lowStockReason).toContain("6 people");
    });

    it("leaves the same carton alone for a single person", () => {
        const result = StockService.assess("1 carton", 1, MILK);

        expect(result.isRunningLow).toBe(false);
        expect(result.suggestedRestockQuantity).toBeNull();
        expect(result.daysOfSupply).toBeGreaterThan(LOW_STOCK_DAYS);
    });

    it("does not flag a condiment that lasts weeks, even for a big household", () => {
        expect(StockService.assess("1 bottle", 6, KETCHUP).isRunningLow).toBe(false);
    });

    it("scores a bare-count bottle as a full package, not a single serving", () => {
        const withName = StockService.assess("1", 7, KETCHUP, "ketchup bottle");
        const withoutName = StockService.assess("1", 7, KETCHUP);

        expect(withName.isRunningLow).toBe(false);
        expect(withName.daysOfSupply).toBeCloseTo(
            withoutName.daysOfSupply! * KETCHUP.packageServings, 0
        );
    });

    it("never flags something the household does not consume", () => {
        expect(StockService.assess("1", 6, NOT_CONSUMED)).toMatchObject({
            isRunningLow: false,
            daysOfSupply: null,
            suggestedRestockQuantity: null,
        });
    });

    it("counts loose pieces and proposes a piece count", () => {
        const result = StockService.assess("2 left", 6, EGGS);

        expect(result.isRunningLow).toBe(true);
        expect(result.suggestedRestockQuantity).toBe("16 more");
    });

    it("proposes a weight when the quantity is a weight", () => {
        const result = StockService.assess("200g", 6, CHICKEN);

        expect(result.isRunningLow).toBe(true);
        expect(result.suggestedRestockQuantity).toMatch(/^\d+(\.\d+)?(kg|g)$/);
    });

    it("proposes a volume when the quantity is a volume", () => {
        const result = StockService.assess("1 liter", 6, JUICE);

        expect(result.isRunningLow).toBe(true);
        expect(result.suggestedRestockQuantity).toMatch(/liters?$/);
    });

    it("reports 'unknown' rather than 'low' when no profile is available", () => {
        expect(StockService.assess("1 carton", 6, undefined)).toMatchObject({
            isRunningLow: false,
            daysOfSupply: null,
            lowStockReason: null,
        });
    });

    it("shrinks days of supply as the household grows", () => {
        const small = StockService.assess("2 cartons", 2, MILK).daysOfSupply!;
        const large = StockService.assess("2 cartons", 6, MILK).daysOfSupply!;

        expect(small).toBeGreaterThan(large);
        expect(large).toBeCloseTo(small / 3, 1);
    });

    it("treats a household size of 0 as a single person", () => {
        expect(StockService.assess("1 carton", 0, MILK)).toEqual(
            StockService.assess("1 carton", 1, MILK)
        );
    });
});
