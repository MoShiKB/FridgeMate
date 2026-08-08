import mongoose from "mongoose";
import { ApiError } from "../utils/errors";
import { InventoryItemModel } from "../models/inventory-item.model";
import { FridgeModel } from "../models/fridge.model";
import { ConsumptionProfileService } from "./consumption-profile.service";
import { StockService, NO_ASSESSMENT, StockAssessment } from "./stock.service";
import { io } from "../index";
import {
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  InventoryItemQuery,
} from "../validators/inventory-item.validators";

export class InventoryItemService {
  /**
   * How many people an item has to stretch across. Assigning an owner to a
   * SHARED item marks who's responsible for it and deliberately does not change
   * this — otherwise the low-stock flag would flip every time someone was tagged.
   */
  private static householdSizeFor(ownership: string, memberCount: number) {
    return ownership === "SHARED" ? Math.max(1, memberCount) : 1;
  }

  /**
   * Falls back to "unknown" (never low) when no profile can be resolved, so an
   * AI outage can't spam the household with restock warnings.
   */
  private static async assessStock(
    name: string,
    quantity: string,
    ownership: string,
    memberCount: number
  ): Promise<StockAssessment> {
    try {
      const profiles = await ConsumptionProfileService.getProfiles([name]);
      const profile = profiles.get(ConsumptionProfileService.normalizeKey(name));
      return StockService.assess(
        quantity,
        this.householdSizeFor(ownership, memberCount),
        profile,
        name
      );
    } catch (err) {
      console.warn("Stock assessment failed", err);
      return NO_ASSESSMENT;
    }
  }

  /**
   * Verify user is a member of the fridge
   */
  private static async verifyFridgeMembership(
    fridgeId: string,
    userId: string
  ) {
    const fridge = await FridgeModel.findById(fridgeId);
    if (!fridge) {
      throw new ApiError(404, "Fridge not found", "FRIDGE_NOT_FOUND");
    }

    const isMember = fridge.members.some(
      (m) => m.userId.toString() === userId
    );
    if (!isMember) {
      throw new ApiError(403, "Not a member of this fridge", "FORBIDDEN");
    }

    return fridge;
  }

  /**
   * Create a new inventory item
   */
  static async create(
    fridgeId: string,
    userId: string,
    data: Omit<CreateInventoryItemInput, "fridgeId">
  ) {
    const fridge = await this.verifyFridgeMembership(fridgeId, userId);
    const ownership = data.ownership ?? "PRIVATE";

    const assessment = await this.assessStock(
      data.name,
      data.quantity,
      ownership,
      fridge.members.length
    );

    const item = await InventoryItemModel.create({
      fridgeId: new mongoose.Types.ObjectId(fridgeId),
      ownerId: new mongoose.Types.ObjectId(userId),
      name: data.name,
      quantity: data.quantity,
      ownership,
      ...assessment,
    });

    return item.toObject();
  }

  /**
   * Get all items in a fridge (respecting visibility rules)
   * - SHARED items visible to all members
   * - PRIVATE items visible only to owner
   */
  static async getAll(
    fridgeId: string,
    userId: string,
    query: InventoryItemQuery,
    pagination: { skip: number; limit: number }
  ) {
    await this.verifyFridgeMembership(fridgeId, userId);

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const fridgeObjectId = new mongoose.Types.ObjectId(fridgeId);

    // Visibility: SHARED items OR user's PRIVATE items — unless a specific
    // ownership is requested, in which case that alone determines visibility.
    const visibilityCondition: any =
      query.ownership === "PRIVATE"
        ? { ownership: "PRIVATE", ownerId: userObjectId }
        : query.ownership === "SHARED"
        ? { ownership: "SHARED" }
        : {
            $or: [
              { ownership: "SHARED" },
              { ownership: "PRIVATE", ownerId: userObjectId },
            ],
          };

    const conditions: any[] = [visibilityCondition];
    if (query.mineOrUnowned) {
      conditions.push({ ownerId: { $in: [null, userObjectId] } });
    }

    const filter: any =
      conditions.length === 1
        ? { fridgeId: fridgeObjectId, ...conditions[0] }
        : { fridgeId: fridgeObjectId, $and: conditions };

    const [items, total] = await Promise.all([
      InventoryItemModel.find(filter)
        // _id breaks createdAt ties so page boundaries stay put between requests.
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      InventoryItemModel.countDocuments(filter),
    ]);

    return { items, total };
  }

  /**
   * Get a single item by ID
   */
  static async getById(itemId: string, userId: string) {
    const item = await InventoryItemModel.findById(itemId);
    if (!item) {
      throw new ApiError(404, "Item not found", "ITEM_NOT_FOUND");
    }

    // Verify user is a member of the fridge
    await this.verifyFridgeMembership(item.fridgeId.toString(), userId);

    // Check visibility: PRIVATE items only visible to owner
    if (
      item.ownership === "PRIVATE" &&
      item.ownerId?.toString() !== userId
    ) {
      throw new ApiError(403, "Not allowed to view this item", "FORBIDDEN");
    }

    return item.toObject();
  }

  /**
   * Update an item (only owner can update)
   */
  static async update(
    itemId: string,
    userId: string,
    data: UpdateInventoryItemInput
  ) {
    const item = await InventoryItemModel.findById(itemId);
    if (!item) {
      throw new ApiError(404, "Item not found", "ITEM_NOT_FOUND");
    }

    // Only owner can update
    if (item.ownerId?.toString() !== userId) {
      throw new ApiError(403, "Only item owner can update", "FORBIDDEN");
    }

    // Apply updates
    if (data.name !== undefined) item.name = data.name;
    if (data.quantity !== undefined) item.quantity = data.quantity;
    if (data.ownership !== undefined) item.ownership = data.ownership;

    // Re-check stock levels if name, quantity OR ownership changed
    if (data.name !== undefined || data.quantity !== undefined || data.ownership !== undefined) {
      const fridge = await FridgeModel.findById(item.fridgeId);
      if (fridge) {
        const assessment = await this.assessStock(
          item.name,
          item.quantity,
          item.ownership,
          fridge.members.length
        );
        Object.assign(item, assessment);
      }
    }

    await item.save();
    return item.toObject();
  }

  /**
   * Reassign an item's owner (any fridge member can reassign to any fridge member),
   * or pass newOwnerId = null to unassign it.
   */
  static async assignOwner(
    itemId: string,
    requesterId: string,
    newOwnerId: string | null
  ) {
    const item = await InventoryItemModel.findById(itemId);
    if (!item) {
      throw new ApiError(404, "Item not found", "ITEM_NOT_FOUND");
    }

    const fridge = await this.verifyFridgeMembership(
      item.fridgeId.toString(),
      requesterId
    );

    if (newOwnerId !== null) {
      const isNewOwnerMember = fridge.members.some(
        (m) => m.userId.toString() === newOwnerId
      );
      if (!isNewOwnerMember) {
        throw new ApiError(400, "New owner must be a fridge member", "INVALID_OWNER");
      }
      item.ownerId = new mongoose.Types.ObjectId(newOwnerId);
    } else {
      item.ownerId = null;
    }
    await item.save();

    for (const member of fridge.members) {
      io.to(member.userId.toString()).emit("itemOwnerChanged", {
        fridgeId: item.fridgeId.toString(),
        itemId: item._id.toString(),
        ownerId: newOwnerId,
      });
    }

    return item.toObject();
  }

  /**
   * Delete an item (only owner can delete)
   */
  static async delete(itemId: string, userId: string) {
    const item = await InventoryItemModel.findById(itemId);
    if (!item) {
      throw new ApiError(404, "Item not found", "ITEM_NOT_FOUND");
    }

    // Only owner can delete
    if (item.ownerId?.toString() !== userId) {
      throw new ApiError(403, "Only item owner can delete", "FORBIDDEN");
    }

    await item.deleteOne();
    return { ok: true };
  }

  /**
   * Re-assesses every item in a fridge. Costs no AI calls once the fridge's item
   * names have been profiled, which is what makes it practical to run on every
   * member change and scan.
   */
  static async recalculateFridgeStock(fridgeId: string, memberCount?: number) {
    try {
      const fridgeObjectId = new mongoose.Types.ObjectId(fridgeId);

      let people = memberCount;
      if (people === undefined) {
        const fridge = await FridgeModel.findById(fridgeId).select("members").lean();
        if (!fridge) return;
        people = fridge.members.length;
      }

      const items = await InventoryItemModel.find({ fridgeId: fridgeObjectId })
        .select("_id name quantity ownership isRunningLow daysOfSupply suggestedRestockQuantity lowStockReason")
        .lean();

      if (items.length === 0) return;

      const profiles = await ConsumptionProfileService.getProfiles(
        items.map((item) => item.name)
      );

      const updates: any[] = [];
      for (const item of items) {
        const profile = profiles.get(ConsumptionProfileService.normalizeKey(item.name));
        const assessment = StockService.assess(
          item.quantity,
          this.householdSizeFor(item.ownership, people),
          profile,
          item.name
        );

        const unchanged =
          item.isRunningLow === assessment.isRunningLow &&
          (item.daysOfSupply ?? null) === assessment.daysOfSupply &&
          (item.suggestedRestockQuantity ?? null) === assessment.suggestedRestockQuantity &&
          (item.lowStockReason ?? null) === assessment.lowStockReason;
        if (unchanged) continue;

        updates.push({
          updateOne: {
            filter: { _id: item._id },
            update: { $set: assessment },
          },
        });
      }

      if (updates.length > 0) {
        await InventoryItemModel.bulkWrite(updates, { ordered: false });
      }
    } catch (error) {
      console.error("Failed to recalculate fridge stock:", error);
    }
  }
}
