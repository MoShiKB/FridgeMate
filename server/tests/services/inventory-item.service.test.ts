import mongoose from "mongoose";

jest.mock("../../services/ai.service", () => ({
    AIService: {
        getConsumptionProfiles: jest.fn(),
    },
}));

// Prevent fire-and-forget notification work from leaking across tests.
jest.mock("../../services/notification.service", () => ({
    NotificationService: {
        sendNotification: jest.fn().mockResolvedValue(undefined),
        removeNotification: jest.fn().mockResolvedValue(undefined),
    },
}));

import { InventoryItemService } from "../../services/inventory-item.service";
import { InventoryItemModel } from "../../models/inventory-item.model";
import { ConsumptionProfileModel } from "../../models/consumption-profile.model";
import { FridgeModel } from "../../models/fridge.model";
import { AIService } from "../../services/ai.service";
import { ConsumptionProfile } from "../../services/stock.service";
import { userId } from "../setup";

const mockedAI = AIService as jest.Mocked<typeof AIService>;

/** One carton is 8 servings; a person drinks 4 servings a week. */
const MILK_PROFILE: ConsumptionProfile = {
    pieceServings: 1,
    packageServings: 8,
    gramsPerServing: 250,
    mlPerServing: 250,
    servingsPerPersonPerWeek: 4,
};

/** A jar lasts a household for weeks. */
const CONDIMENT_PROFILE: ConsumptionProfile = {
    pieceServings: 1,
    packageServings: 30,
    gramsPerServing: 15,
    mlPerServing: 15,
    servingsPerPersonPerWeek: 0.5,
};

/** Answers every requested name with the same profile. */
const respondWith = (profile: ConsumptionProfile) =>
    mockedAI.getConsumptionProfiles.mockImplementation(async (names: string[]) =>
        new Map(names.map((name) => [name, profile]))
    );

describe("InventoryItemService (branches)", () => {
    let fridgeId: string;
    let otherUserId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        jest.clearAllMocks();
        await ConsumptionProfileModel.deleteMany({});
        respondWith(MILK_PROFILE);

        otherUserId = new mongoose.Types.ObjectId();
        const fridge = await FridgeModel.create({
            name: "Inv",
            inviteCode: `INV_${Date.now()}`,
            members: [
                { userId: new mongoose.Types.ObjectId(userId), joinedAt: new Date() },
                { userId: otherUserId, joinedAt: new Date() },
            ],
        });
        fridgeId = fridge._id.toString();
    });

    describe("create", () => {
        it("flags a new item as low and proposes how much to buy", async () => {
            const item = await InventoryItemService.create(fridgeId, userId.toString(), {
                name: "Milk",
                quantity: "250ml",
                ownership: "SHARED",
            } as any);

            expect(item.name).toBe("Milk");
            expect(item.isRunningLow).toBe(true);
            expect(item.suggestedRestockQuantity).toBeTruthy();
            expect(item.lowStockReason).toContain("2 people");
        });

        it("leaves a well-stocked item alone", async () => {
            const item = await InventoryItemService.create(fridgeId, userId.toString(), {
                name: "Ketchup",
                quantity: "1 bottle",
                ownership: "SHARED",
            } as any);

            expect(item.isRunningLow).toBe(false);
            expect(item.suggestedRestockQuantity).toBeNull();
        });

        it("falls back to 'not low' when the profile lookup throws", async () => {
            mockedAI.getConsumptionProfiles.mockRejectedValueOnce(new Error("AI down"));
            const item = await InventoryItemService.create(fridgeId, userId.toString(), {
                name: "Eggs",
                quantity: "1",
                ownership: "PRIVATE",
            } as any);

            expect(item.isRunningLow).toBe(false);
            expect(item.daysOfSupply).toBeNull();
        });

        it("measures a PRIVATE item against one person even in a multi-member fridge", async () => {
            const shared = await InventoryItemService.create(fridgeId, userId.toString(), {
                name: "Milk",
                quantity: "1 carton",
                ownership: "SHARED",
            } as any);
            const priv = await InventoryItemService.create(fridgeId, userId.toString(), {
                name: "Milk",
                quantity: "1 carton",
                ownership: "PRIVATE",
            } as any);

            expect(priv.daysOfSupply).toBeCloseTo(shared.daysOfSupply! * 2, 1);
            expect(priv.isRunningLow).toBe(false);
        });

        it("defaults ownership to PRIVATE when not supplied", async () => {
            const item = await InventoryItemService.create(fridgeId, userId.toString(), {
                name: "Bread",
                quantity: "1 loaf",
            } as any);
            expect(item.ownership).toBe("PRIVATE");
        });

        it("throws 404 FRIDGE_NOT_FOUND when the fridge is missing", async () => {
            const bogus = new mongoose.Types.ObjectId().toString();
            await expect(
                InventoryItemService.create(bogus, userId.toString(), {
                    name: "x",
                    quantity: "1",
                } as any)
            ).rejects.toMatchObject({ status: 404, code: "FRIDGE_NOT_FOUND" });
        });

        it("throws 403 FORBIDDEN when caller is not a member of the fridge", async () => {
            const stranger = new mongoose.Types.ObjectId().toString();
            await expect(
                InventoryItemService.create(fridgeId, stranger, {
                    name: "x",
                    quantity: "1",
                } as any)
            ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
        });
    });

    describe("getAll", () => {
        beforeEach(async () => {
            await InventoryItemModel.create([
                { fridgeId, ownerId: userId, name: "own-priv", quantity: "1", ownership: "PRIVATE" },
                { fridgeId, ownerId: otherUserId, name: "other-priv", quantity: "1", ownership: "PRIVATE" },
                { fridgeId, ownerId: otherUserId, name: "shared", quantity: "1", ownership: "SHARED" },
                { fridgeId, ownerId: null, name: "unowned-shared", quantity: "1", ownership: "SHARED" },
            ]);
        });

        it("returns SHARED + user's own PRIVATE items by default", async () => {
            const result = await InventoryItemService.getAll(
                fridgeId,
                userId.toString(),
                {} as any,
                { skip: 0, limit: 50 }
            );
            const names = result.items.map((i: any) => i.name).sort();
            expect(names).toEqual(["own-priv", "shared", "unowned-shared"]);
        });

        it("filters to only PRIVATE items owned by caller when ownership=PRIVATE", async () => {
            const result = await InventoryItemService.getAll(
                fridgeId,
                userId.toString(),
                { ownership: "PRIVATE" } as any,
                { skip: 0, limit: 50 }
            );
            expect(result.items.map((i: any) => i.name)).toEqual(["own-priv"]);
        });

        it("filters to SHARED items when ownership=SHARED", async () => {
            const result = await InventoryItemService.getAll(
                fridgeId,
                userId.toString(),
                { ownership: "SHARED" } as any,
                { skip: 0, limit: 50 }
            );
            expect(result.items.map((i: any) => i.name).sort()).toEqual(["shared", "unowned-shared"]);
        });

        it("with mineOrUnowned returns caller-owned or unowned items only", async () => {
            const result = await InventoryItemService.getAll(
                fridgeId,
                userId.toString(),
                { mineOrUnowned: true } as any,
                { skip: 0, limit: 50 }
            );
            const names = result.items.map((i: any) => i.name).sort();
            expect(names).toEqual(["own-priv", "unowned-shared"]);
        });
    });

    describe("getById", () => {
        it("returns the item for its owner (PRIVATE)", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: userId, name: "p", quantity: "1", ownership: "PRIVATE",
            });
            const got = await InventoryItemService.getById(item._id.toString(), userId.toString());
            expect(got.name).toBe("p");
        });

        it("throws 403 when a non-owner tries to view a PRIVATE item", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: otherUserId, name: "secret", quantity: "1", ownership: "PRIVATE",
            });
            await expect(
                InventoryItemService.getById(item._id.toString(), userId.toString())
            ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
        });

        it("throws 404 for a non-existent item", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            await expect(
                InventoryItemService.getById(fakeId, userId.toString())
            ).rejects.toMatchObject({ status: 404, code: "ITEM_NOT_FOUND" });
        });
    });

    describe("update", () => {
        it("only the owner can update an item", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: otherUserId, name: "n", quantity: "1", ownership: "SHARED",
            });
            await expect(
                InventoryItemService.update(item._id.toString(), userId.toString(), { name: "x" })
            ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
        });

        it("updates only the provided fields", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: userId, name: "old", quantity: "1 kg", ownership: "PRIVATE",
            });
            const updated = await InventoryItemService.update(item._id.toString(), userId.toString(), {
                name: "new",
            });
            expect(updated.name).toBe("new");
            expect(updated.quantity).toBe("1 kg"); // unchanged
        });

        it("re-checks running-low when ownership changes (SHARED → PRIVATE)", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: userId, name: "milk", quantity: "500ml", ownership: "SHARED",
            });
            const asShared = await InventoryItemService.update(item._id.toString(), userId.toString(), {
                quantity: "500ml",
            });
            const asPrivate = await InventoryItemService.update(item._id.toString(), userId.toString(), {
                ownership: "PRIVATE",
            });

            // Halving the household roughly doubles how long the stock lasts
            // (exact ratio drifts slightly because daysOfSupply is rounded).
            expect(asPrivate.daysOfSupply).toBeCloseTo(asShared.daysOfSupply! * 2, 0);
        });

        it("clears the restock proposal once the quantity is topped up", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: userId, name: "milk", quantity: "250ml", ownership: "SHARED",
            });
            const low = await InventoryItemService.update(item._id.toString(), userId.toString(), {
                quantity: "250ml",
            });
            expect(low.isRunningLow).toBe(true);

            const restocked = await InventoryItemService.update(item._id.toString(), userId.toString(), {
                quantity: "4 cartons",
            });
            expect(restocked.isRunningLow).toBe(false);
            expect(restocked.suggestedRestockQuantity).toBeNull();
            expect(restocked.lowStockReason).toBeNull();
        });

        it("swallows profile lookup errors during the stock re-check", async () => {
            mockedAI.getConsumptionProfiles.mockRejectedValueOnce(new Error("boom"));
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: userId, name: "n", quantity: "1", ownership: "PRIVATE",
            });
            const updated = await InventoryItemService.update(item._id.toString(), userId.toString(), {
                quantity: "2",
            });
            expect(updated.quantity).toBe("2");
        });

        it("throws 404 when updating a non-existent item", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            await expect(
                InventoryItemService.update(fakeId, userId.toString(), { name: "x" })
            ).rejects.toMatchObject({ status: 404, code: "ITEM_NOT_FOUND" });
        });
    });

    describe("assignOwner", () => {
        it("reassigns ownership to another fridge member", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: userId, name: "n", quantity: "1", ownership: "SHARED",
            });
            const updated = await InventoryItemService.assignOwner(
                item._id.toString(),
                userId.toString(),
                otherUserId.toString()
            );
            expect(updated.ownerId?.toString()).toBe(otherUserId.toString());
        });

        it("unassigns ownership when newOwnerId is null", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: userId, name: "n", quantity: "1", ownership: "SHARED",
            });
            const updated = await InventoryItemService.assignOwner(
                item._id.toString(),
                userId.toString(),
                null
            );
            expect(updated.ownerId).toBeNull();
        });

        it("throws 400 INVALID_OWNER for a non-member", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: userId, name: "n", quantity: "1", ownership: "SHARED",
            });
            const stranger = new mongoose.Types.ObjectId().toString();
            await expect(
                InventoryItemService.assignOwner(item._id.toString(), userId.toString(), stranger)
            ).rejects.toMatchObject({ status: 400, code: "INVALID_OWNER" });
        });

        it("throws 404 when the item does not exist", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            await expect(
                InventoryItemService.assignOwner(fakeId, userId.toString(), otherUserId.toString())
            ).rejects.toMatchObject({ status: 404, code: "ITEM_NOT_FOUND" });
        });
    });

    describe("delete", () => {
        it("owner can delete an item", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: userId, name: "n", quantity: "1", ownership: "PRIVATE",
            });
            const res = await InventoryItemService.delete(item._id.toString(), userId.toString());
            expect(res.ok).toBe(true);
            expect(await InventoryItemModel.findById(item._id)).toBeNull();
        });

        it("non-owner cannot delete", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: otherUserId, name: "n", quantity: "1", ownership: "SHARED",
            });
            await expect(
                InventoryItemService.delete(item._id.toString(), userId.toString())
            ).rejects.toMatchObject({ status: 403 });
        });

        it("throws 404 for a non-existent item", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            await expect(
                InventoryItemService.delete(fakeId, userId.toString())
            ).rejects.toMatchObject({ status: 404, code: "ITEM_NOT_FOUND" });
        });
    });

    describe("recalculateFridgeStock", () => {
        it("flags shared stock that a bigger household would burn through", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: null, name: "milk", quantity: "1 carton",
                ownership: "SHARED", isRunningLow: false,
            });

            await InventoryItemService.recalculateFridgeStock(fridgeId, 2);
            expect((await InventoryItemModel.findById(item._id))!.isRunningLow).toBe(false);

            await InventoryItemService.recalculateFridgeStock(fridgeId, 8);
            const after = await InventoryItemModel.findById(item._id);
            expect(after!.isRunningLow).toBe(true);
            expect(after!.suggestedRestockQuantity).toBeTruthy();
        });

        it("clears the flag again when the household shrinks", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: null, name: "milk", quantity: "1 carton",
                ownership: "SHARED", isRunningLow: true, suggestedRestockQuantity: "3 cartons",
            });

            await InventoryItemService.recalculateFridgeStock(fridgeId, 1);
            const after = await InventoryItemModel.findById(item._id);
            expect(after!.isRunningLow).toBe(false);
            expect(after!.suggestedRestockQuantity).toBeNull();
        });

        it("leaves PRIVATE items measured against a single person", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: userId, name: "milk", quantity: "1 carton", ownership: "PRIVATE",
            });

            await InventoryItemService.recalculateFridgeStock(fridgeId, 8);
            expect((await InventoryItemModel.findById(item._id))!.isRunningLow).toBe(false);
        });

        it("reads the member count from the fridge when not given one", async () => {
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: null, name: "milk", quantity: "1 carton", ownership: "SHARED",
            });

            await InventoryItemService.recalculateFridgeStock(fridgeId);
            expect((await InventoryItemModel.findById(item._id))!.daysOfSupply).not.toBeNull();
        });

        it("only asks the AI for names it has not profiled before", async () => {
            await InventoryItemModel.create([
                { fridgeId, ownerId: null, name: "milk", quantity: "1 carton", ownership: "SHARED" },
                { fridgeId, ownerId: null, name: "milk", quantity: "2 cartons", ownership: "SHARED" },
            ] as any);

            await InventoryItemService.recalculateFridgeStock(fridgeId, 4);
            expect(mockedAI.getConsumptionProfiles).toHaveBeenCalledTimes(1);
            expect(mockedAI.getConsumptionProfiles).toHaveBeenCalledWith(["milk"]);

            // Second pass is served entirely from the cached profile.
            mockedAI.getConsumptionProfiles.mockClear();
            await InventoryItemService.recalculateFridgeStock(fridgeId, 5);
            expect(mockedAI.getConsumptionProfiles).not.toHaveBeenCalled();
        });

        it("swallows errors so a recompute never breaks its caller", async () => {
            await InventoryItemModel.create({
                fridgeId, ownerId: null, name: "milk", quantity: "1L", ownership: "SHARED",
            });
            mockedAI.getConsumptionProfiles.mockRejectedValueOnce(new Error("boom"));
            await expect(
                InventoryItemService.recalculateFridgeStock(fridgeId, 3)
            ).resolves.not.toThrow();
        });
    });
});
