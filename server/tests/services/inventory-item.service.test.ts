import mongoose from "mongoose";

jest.mock("../../services/ai.service", () => ({
    AIService: {
        checkIfRunningLow: jest.fn(),
        checkMultipleItemsIfRunningLow: jest.fn(),
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
import { FridgeModel } from "../../models/fridge.model";
import { AIService } from "../../services/ai.service";
import { userId } from "../setup";

const mockedAI = AIService as jest.Mocked<typeof AIService>;

describe("InventoryItemService (branches)", () => {
    let fridgeId: string;
    let otherUserId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockedAI.checkIfRunningLow.mockResolvedValue({ isRunningLow: false, reasoning: "ok" });
        mockedAI.checkMultipleItemsIfRunningLow.mockResolvedValue(new Map());

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
        it("creates an item and consults the AI stock check", async () => {
            mockedAI.checkIfRunningLow.mockResolvedValueOnce({ isRunningLow: true, reasoning: "low" });
            const item = await InventoryItemService.create(fridgeId, userId.toString(), {
                name: "Milk",
                quantity: "500ml",
                ownership: "SHARED",
            } as any);
            expect(item.name).toBe("Milk");
            expect(item.isRunningLow).toBe(true);
            expect(mockedAI.checkIfRunningLow).toHaveBeenCalledWith("Milk", "500ml", 2);
        });

        it("falls back gracefully when the AI check throws", async () => {
            mockedAI.checkIfRunningLow.mockRejectedValueOnce(new Error("AI down"));
            const item = await InventoryItemService.create(fridgeId, userId.toString(), {
                name: "Eggs",
                quantity: "6",
                ownership: "PRIVATE",
            } as any);
            expect(item.isRunningLow).toBe(false);
        });

        it("uses userCount=1 for PRIVATE ownership even in a multi-member fridge", async () => {
            await InventoryItemService.create(fridgeId, userId.toString(), {
                name: "Cheese",
                quantity: "1 block",
                ownership: "PRIVATE",
            } as any);
            expect(mockedAI.checkIfRunningLow).toHaveBeenCalledWith("Cheese", "1 block", 1);
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
            mockedAI.checkIfRunningLow.mockResolvedValueOnce({ isRunningLow: true, reasoning: "low" });
            const item = await InventoryItemModel.create({
                fridgeId, ownerId: userId, name: "milk", quantity: "1L", ownership: "SHARED",
            });
            const updated = await InventoryItemService.update(item._id.toString(), userId.toString(), {
                ownership: "PRIVATE",
            });
            expect(updated.isRunningLow).toBe(true);
            expect(mockedAI.checkIfRunningLow).toHaveBeenCalledWith("milk", "1L", 1);
        });

        it("swallows AI errors during the stock re-check", async () => {
            mockedAI.checkIfRunningLow.mockRejectedValueOnce(new Error("boom"));
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

    describe("recalculateSharedItemsStatus", () => {
        it("no-ops when there are no SHARED items", async () => {
            await InventoryItemModel.create({
                fridgeId, ownerId: userId, name: "priv", quantity: "1", ownership: "PRIVATE",
            });
            await InventoryItemService.recalculateSharedItemsStatus(fridgeId, 2);
            expect(mockedAI.checkMultipleItemsIfRunningLow).not.toHaveBeenCalled();
        });

        it("bulk-updates only items whose status changes", async () => {
            const a = await InventoryItemModel.create({
                fridgeId, ownerId: null, name: "milk", quantity: "1L", ownership: "SHARED", isRunningLow: false,
            });
            const b = await InventoryItemModel.create({
                fridgeId, ownerId: null, name: "eggs", quantity: "12", ownership: "SHARED", isRunningLow: true,
            });

            const statusMap = new Map<string, boolean>();
            statusMap.set(a._id.toString(), true);   // changed (false → true)
            statusMap.set(b._id.toString(), true);   // unchanged (true → true)
            mockedAI.checkMultipleItemsIfRunningLow.mockResolvedValueOnce(statusMap);

            await InventoryItemService.recalculateSharedItemsStatus(fridgeId, 4);

            const [afterA, afterB] = await Promise.all([
                InventoryItemModel.findById(a._id),
                InventoryItemModel.findById(b._id),
            ]);
            expect(afterA!.isRunningLow).toBe(true);
            expect(afterB!.isRunningLow).toBe(true);
        });

        it("chunks large item batches (CHUNK_SIZE=20)", async () => {
            const bulk = Array.from({ length: 25 }).map((_, i) => ({
                fridgeId, ownerId: null, name: `s-${i}`, quantity: "1", ownership: "SHARED", isRunningLow: false,
            }));
            await InventoryItemModel.create(bulk as any);

            mockedAI.checkMultipleItemsIfRunningLow.mockResolvedValue(new Map());

            await InventoryItemService.recalculateSharedItemsStatus(fridgeId, 2);
            expect(mockedAI.checkMultipleItemsIfRunningLow).toHaveBeenCalledTimes(2);
        });

        it("swallows AI errors so a running-low recompute never breaks a caller", async () => {
            await InventoryItemModel.create({
                fridgeId, ownerId: null, name: "milk", quantity: "1L", ownership: "SHARED",
            });
            mockedAI.checkMultipleItemsIfRunningLow.mockRejectedValueOnce(new Error("boom"));
            await expect(
                InventoryItemService.recalculateSharedItemsStatus(fridgeId, 3)
            ).resolves.not.toThrow();
        });
    });
});
