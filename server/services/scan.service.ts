import mongoose from "mongoose";
import { ApiError } from "../utils/errors";
import { ScanModel } from "../models/scan.model";
import { InventoryItemModel } from "../models/inventory-item.model";
import { FridgeModel } from "../models/fridge.model";
import { UserModel } from "../models/user.model";
import { AIService } from "./ai.service";

export class ScanService {
  /**
   * Upload and process a fridge scan image.
   * Detects items via AI, then creates/updates inventory items.
   */
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

    for (const detected of detectedItems) {
      const existing = await InventoryItemModel.findOne({
        fridgeId: new mongoose.Types.ObjectId(fridgeId),
        name: { $regex: new RegExp(`^${escapeRegex(detected.name)}$`, "i") },
      });

      if (existing) {
        existing.quantity = detected.quantity;

        try {
          const currentOwnership = existing.ownership;
          const userCount = currentOwnership === "SHARED" ? memberCount : 1;
          const aiResult = await AIService.checkIfRunningLow(
            existing.name,
            existing.quantity,
            userCount
          );
          existing.isRunningLow = aiResult.isRunningLow;
        } catch {
          // Ignore AI failure for stock check
        }

        await existing.save();
        addedItemIds.push(existing._id as mongoose.Types.ObjectId);
      } else {
        let isRunningLow = false;
        try {
          const aiResult = await AIService.checkIfRunningLow(
            detected.name,
            detected.quantity,
            memberCount
          );
          isRunningLow = aiResult.isRunningLow;
        } catch {
          // Ignore AI failure for stock check
        }

        const newItem = await InventoryItemModel.create({
          fridgeId: new mongoose.Types.ObjectId(fridgeId),
          ownerId: new mongoose.Types.ObjectId(userId),
          name: detected.name,
          quantity: detected.quantity,
          ownership: "SHARED",
          isRunningLow,
        });
        addedItemIds.push(newItem._id as mongoose.Types.ObjectId);
      }
    }

    const scan = await ScanModel.create({
      fridgeId: new mongoose.Types.ObjectId(fridgeId),
      userId: new mongoose.Types.ObjectId(userId),
      status: "completed",
      detectedItems,
      addedItemIds,
    });

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
