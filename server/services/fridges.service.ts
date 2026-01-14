import mongoose from "mongoose";
import { ApiError } from "../utils/errors";
import { FridgeModel } from "../models/fridge.model";
import { UserModel } from "../models/user.model";

function makeInviteCode() {

  const part = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${part}`;
}

export class FridgesService {
  static async createFridge(userId: string, name: string) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const fridge = await FridgeModel.create({
      name,
      inviteCode: makeInviteCode(),
      members: [{ userId: userObjectId }],
    });

    await UserModel.findByIdAndUpdate(userId, { activeFridgeId: fridge._id });
    return fridge;
  }

  static async joinByInviteCode(userId: string, inviteCode: string) {
    const fridge = await FridgeModel.findOne({ inviteCode });
    if (!fridge) throw new ApiError(404, "Invalid invite code", "INVITE_NOT_FOUND");

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const already = fridge.members.some((m) => m.userId.toString() === userId);
    if (already) throw new ApiError(409, "User already in this fridge", "ALREADY_IN_FRIDGE");

    fridge.members.push({ userId: userObjectId, joinedAt: new Date() });
    await fridge.save();

    await UserModel.findByIdAndUpdate(userId, { activeFridgeId: fridge._id });
    return fridge;
  }

  static async leaveCurrentFridge(userId: string) {
    const user = await UserModel.findById(userId).lean();
    if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");
    if (!user.activeFridgeId) throw new ApiError(400, "User is not in a fridge", "NO_ACTIVE_FRIDGE");

    const fridge = await FridgeModel.findById(user.activeFridgeId);
    if (!fridge) throw new ApiError(404, "Fridge not found", "FRIDGE_NOT_FOUND");

    fridge.members = fridge.members.filter((m) => m.userId.toString() !== userId);
    await fridge.save();

    await UserModel.findByIdAndUpdate(userId, { activeFridgeId: null });
    return { ok: true };
  }

  static async getMyFridge(userId: string) {
    const user = await UserModel.findById(userId).lean();
    if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");
    if (!user.activeFridgeId) throw new ApiError(404, "User has no active fridge", "NO_ACTIVE_FRIDGE");

    const fridge = await FridgeModel.findById(user.activeFridgeId).lean();
    if (!fridge) throw new ApiError(404, "Fridge not found", "FRIDGE_NOT_FOUND");
    return fridge;
  }

  static async getMyFridgeMembers(userId: string) {
    const fridge = await this.getMyFridge(userId);
    const memberIds = fridge.members.map((m) => m.userId);

    const users = await UserModel.find({ _id: { $in: memberIds } }, { displayName: 1, photoUrl: 1 }).lean();
    return users.map((u) => ({ userId: u._id.toString(), displayName: u.displayName, photoUrl: u.photoUrl }));
  }
}
