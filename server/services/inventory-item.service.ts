import mongoose from "mongoose";
import { ApiError } from "../utils/errors";
import { InventoryItemModel } from "../models/inventory-item.model";
import { FridgeModel } from "../models/fridge.model";
import { AIService } from "./ai.service";
import {
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  InventoryItemQuery,
} from "../validators/inventory-item.validators";

export class InventoryItemService {
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

    // AI Check for running low
    let isRunningLow = false;
    try {
      const ownership = data.ownership ?? "PRIVATE";
      // If shared, consider all members. If private, only the owner (1 person).
      const userCount = ownership === 'SHARED' ? fridge.members.length : 1;

      const aiResult = await AIService.checkIfRunningLow(data.name, data.quantity, userCount);
      isRunningLow = aiResult.isRunningLow;
    } catch (err) {
      console.warn("AI low stock check failed", err);
    }

    const item = await InventoryItemModel.create({
      fridgeId: new mongoose.Types.ObjectId(fridgeId),
      ownerId: new mongoose.Types.ObjectId(userId),
      name: data.name,
      quantity: data.quantity,
      ownership: data.ownership ?? "PRIVATE",
      isRunningLow,
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

    // Build query: SHARED items OR user's PRIVATE items
    const filter: any = {
      fridgeId: fridgeObjectId,
      $or: [
        { ownership: "SHARED" },
        { ownership: "PRIVATE", ownerId: userObjectId },
      ],
    };

    // Apply ownership filter if specified
    if (query.ownership) {
      delete filter.$or;
      if (query.ownership === "PRIVATE") {
        // Only show user's own private items
        filter.ownership = "PRIVATE";
        filter.ownerId = userObjectId;
      } else {
        // Show all shared items
        filter.ownership = "SHARED";
      }
    }

    const [items, total] = await Promise.all([
      InventoryItemModel.find(filter)
        .sort({ createdAt: -1 })
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
      item.ownerId.toString() !== userId
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
    if (item.ownerId.toString() !== userId) {
      throw new ApiError(403, "Only item owner can update", "FORBIDDEN");
    }

    // Apply updates
    if (data.name !== undefined) item.name = data.name;
    if (data.quantity !== undefined) item.quantity = data.quantity;
    if (data.ownership !== undefined) item.ownership = data.ownership;

    // Re-check stock levels if name, quantity OR ownership changed
    if (data.name !== undefined || data.quantity !== undefined || data.ownership !== undefined) {
      try {
        const fridge = await FridgeModel.findById(item.fridgeId);
        if (fridge) {
          // Determine user count based on the (possibly updated) ownership
          const currentOwnership = data.ownership ?? item.ownership;
          const userCount = currentOwnership === 'SHARED' ? fridge.members.length : 1;

          const aiResult = await AIService.checkIfRunningLow(
            item.name,
            item.quantity,
            userCount
          );
          item.isRunningLow = aiResult.isRunningLow;
        }
      } catch (err) {
        console.warn("AI low stock re-check failed", err);
      }
    }

    await item.save();
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
    if (item.ownerId.toString() !== userId) {
      throw new ApiError(403, "Only item owner can delete", "FORBIDDEN");
    }

    await item.deleteOne();
    return { ok: true };
  }

  /**
   * Recalculates 'isRunningLow' status for all SHARED items in a fridge based on new member count.
   * This is typically called when a user joins or leaves a fridge.
   */
  static async recalculateSharedItemsStatus(fridgeId: string, memberCount: number) {
    try {
      // Find all SHARED items in the fridge
      const items = await InventoryItemModel.find({
        fridgeId: new mongoose.Types.ObjectId(fridgeId),
        ownership: 'SHARED'
      }).select('_id name quantity isRunningLow');

      if (items.length === 0) return;

      // Prepare items for AI check
      const itemsToCheck = items.map(item => ({
        id: item._id.toString(),
        name: item.name,
        quantity: item.quantity
      }));

      // Process in chunks to avoid overwhelming the AI or hitting token limits
      const CHUNK_SIZE = 20;
      for (let i = 0; i < itemsToCheck.length; i += CHUNK_SIZE) {
        const chunk = itemsToCheck.slice(i, i + CHUNK_SIZE);

        // Call AI Service (Batch)
        const statusMap = await AIService.checkMultipleItemsIfRunningLow(chunk, memberCount);

        // Prepare bulk updates for items where status has changed
        const updates: any[] = [];
        for (const itemData of chunk) {
          const newStatus = statusMap.get(itemData.id);

          // Only update if we got a result and it's different from current status
          if (newStatus !== undefined) {
            const originalItem = items.find(it => it._id.toString() === itemData.id);
            if (originalItem && originalItem.isRunningLow !== newStatus) {
              updates.push({
                updateOne: {
                  filter: { _id: originalItem._id },
                  update: { $set: { isRunningLow: newStatus } }
                }
              });
            }
          }
        }

        if (updates.length > 0) {
          await InventoryItemModel.bulkWrite(updates);
          console.log(`Updated isRunningLow status for ${updates.length} shared items in fridge ${fridgeId}`);
        }
      }
    } catch (error) {
      console.error("Failed to recalculate shared items status:", error);
    }
  }
}
