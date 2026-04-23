import mongoose from "mongoose";
import { ApiError } from "../utils/errors";
import { ScanModel } from "../models/scan.model";
import { InventoryItemModel } from "../models/inventory-item.model";
import { FridgeModel } from "../models/fridge.model";
import { UserModel } from "../models/user.model";
import { AIService } from "./ai.service";

export class ScanService {

  static async createScan(userId: string, imageBuffer: Buffer, mimeType: string) {
    const user = await UserModel.findById(userId).lean();
    if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");
    if (!user.activeFridgeId) {
      throw new ApiError(400, "User has no active fridge", "NO_ACTIVE_FRIDGE");
    }

    const fridgeId = user.activeFridgeId.toString();
    const fridge = await FridgeModel.findById(fridgeId);
    if (!fridge) throw new ApiError(404, "Fridge not found", "FRIDGE_NOT_FOUND");

    const isMember = fridge.members.some(
      (m) => m.userId.toString() === userId
    );
    if (!isMember) {
      throw new ApiError(403, "Not a member of this fridge", "FORBIDDEN");
    }

    let detectedItems: { name: string; quantity: string }[] = [];

    try {
      detectedItems = await AIService.detectFridgeItems(imageBuffer, mimeType);
    } catch (err: any) {
      const failedScan = await ScanModel.create({
        fridgeId: new mongoose.Types.ObjectId(fridgeId),
        userId: new mongoose.Types.ObjectId(userId),
        status: "failed",
        error: err.message || "AI detection failed",
      });
      return failedScan.toJSON();
    }

    const addedItemIds: mongoose.Types.ObjectId[] = [];
    const memberCount = fridge.members.length;

    
    const processedItems: { id: string; name: string; quantity: string; ownership: string }[] = [];

    for (const detected of detectedItems) {
      const existing = await InventoryItemModel.findOne({
        fridgeId: new mongoose.Types.ObjectId(fridgeId),
        name: { $regex: new RegExp(`^${escapeRegex(detected.name)}$`, "i") },
      });

      if (existing) {
        existing.quantity = detected.quantity;
        await existing.save();
        addedItemIds.push(existing._id as mongoose.Types.ObjectId);
        processedItems.push({
          id: existing._id.toString(),
          name: existing.name,
          quantity: existing.quantity,
          ownership: existing.ownership,
        });
      } else {
        const newItem = await InventoryItemModel.create({
          fridgeId: new mongoose.Types.ObjectId(fridgeId),
          ownerId: new mongoose.Types.ObjectId(userId),
          name: detected.name,
          quantity: detected.quantity,
          ownership: "SHARED",
          isRunningLow: false,
        });
        addedItemIds.push(newItem._id as mongoose.Types.ObjectId);
        processedItems.push({
          id: newItem._id.toString(),
          name: newItem.name,
          quantity: newItem.quantity,
          ownership: newItem.ownership,
        });
      }
    }

    if (addedItemIds.length > 0) {
      await InventoryItemModel.deleteMany({
        fridgeId: new mongoose.Types.ObjectId(fridgeId),
        _id: { $nin: addedItemIds },
      });
    }

    const scan = await ScanModel.create({
      fridgeId: new mongoose.Types.ObjectId(fridgeId),
      userId: new mongoose.Types.ObjectId(userId),
      status: "completed",
      detectedItems,
      addedItemIds,
    });

    // Fire-and-forget: update running-low status in the background
    (async () => {
      try {
        const sharedItems = processedItems.filter(i => i.ownership === "SHARED");
        const privateItems = processedItems.filter(i => i.ownership === "PRIVATE");

        const [sharedResults, privateResults] = await Promise.all([
          sharedItems.length > 0
            ? AIService.checkMultipleItemsIfRunningLow(sharedItems, memberCount)
            : Promise.resolve(new Map<string, boolean>()),
          privateItems.length > 0
            ? AIService.checkMultipleItemsIfRunningLow(privateItems, 1)
            : Promise.resolve(new Map<string, boolean>()),
        ]);

        const statusMap = new Map<string, boolean>([...sharedResults, ...privateResults]);

        const updates = processedItems
          .filter(item => statusMap.has(item.id))
          .map(item => ({
            updateOne: {
              filter: { _id: new mongoose.Types.ObjectId(item.id) },
              update: { $set: { isRunningLow: statusMap.get(item.id) } },
            },
          }));

        if (updates.length > 0) {
          await InventoryItemModel.bulkWrite(updates);
        }
      } catch (err) {
        console.warn("Background running-low check failed:", err);
      }
    })();

    return scan.toJSON();
  }

  /**
   * Get a scan by ID. Verifies user is a member of the scan's fridge.
   */
  static async getScanById(scanId: string, userId: string) {
    const scan = await ScanModel.findById(scanId);
    if (!scan) throw new ApiError(404, "Scan not found", "SCAN_NOT_FOUND");

    const fridge = await FridgeModel.findById(scan.fridgeId);
    if (!fridge) throw new ApiError(404, "Fridge not found", "FRIDGE_NOT_FOUND");

    const isMember = fridge.members.some(
      (m) => m.userId.toString() === userId
    );
    if (!isMember) {
      throw new ApiError(403, "Not a member of this fridge", "FORBIDDEN");
    }

    return scan.toJSON();
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
