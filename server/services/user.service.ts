import mongoose from "mongoose";
import UserModel, { IUser } from "../models/user.model";
import { PostModel } from "../models/post.model";
import { ApiError } from "../utils/errors";
import { NotificationService } from "./notification.service";

/** Strip fields that should never be exposed to non-self callers. */
function scrubForOther(user: any) {
  if (!user) return user;
  const { email, ...rest } = user;
  return rest;
}

export const UserService = {
  /**
   * Get a user by id, enriched with social counts.
   * If callerId is provided and differs from userId, `email` is stripped.
   */
  async getUserById(userId: string, callerId?: string) {
    if (!mongoose.isValidObjectId(userId)) return null;

    const userDoc = await UserModel.findById(userId).lean();
    if (!userDoc) return null;

    const [followersCount, postsCount] = await Promise.all([
      UserModel.countDocuments({ following: userDoc._id }),
      PostModel.countDocuments({ authorUserId: userDoc._id }),
    ]);
    const followingCount = (userDoc.following || []).length;

    let isFollowing = false;
    if (callerId && callerId !== userId) {
      const me = await UserModel.findById(callerId).select("following").lean();
      isFollowing = !!me?.following?.some((id: any) => id.toString() === userId);
    }

    const enriched: any = {
      ...userDoc,
      followersCount,
      followingCount,
      postsCount,
      isFollowing,
    };

    // Don't expose internal-only fields
    delete enriched.following;

    return callerId && callerId !== userId ? scrubForOther(enriched) : enriched;
  },

  async getUserByEmail(email: string) {
    return UserModel.findOne({ email: email.toLowerCase().trim() }).select("+password +refreshToken").exec();
  },

  async getUserByUserName(userName: string) {
    return UserModel.findOne({ userName: userName.toLowerCase().trim() }).exec();
  },

  async updateProfile(userId: string, userData: Partial<IUser>) {
    const update: any = {};

    if (typeof userData.userName === "string") {
      update.userName = userData.userName.trim().toLowerCase();
    }
    if (typeof (userData as any).profileImage === "string") {
      update.profileImage = (userData as any).profileImage.trim();
    }
    if (typeof userData.displayName === "string") {
      update.displayName = userData.displayName.trim();
    }
    if (typeof userData.bio === "string") {
      update.bio = userData.bio.trim();
    }
    if (userData.age !== undefined) update.age = userData.age;
    if (userData.address !== undefined) update.address = userData.address;
    if (userData.allergies !== undefined) update.allergies = userData.allergies;
    if (userData.dietPreference !== undefined) update.dietPreference = userData.dietPreference;

    return UserModel.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true }).lean();
  },

  async getAllUsers() {
    return UserModel.find({}).select("-password -refreshToken -email -following").lean();
  },

  /**
   * Substring match on displayName / userName.
   * Excludes the caller from results (don't suggest you to yourself).
   */
  async search(q: string, callerId: string, opts: { skip: number; limit: number }) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(safe, "i");
    const filter: any = {
      _id: { $ne: new mongoose.Types.ObjectId(callerId) },
      $or: [{ displayName: re }, { userName: re }],
    };
    const [items, total] = await Promise.all([
      UserModel.find(filter)
        .select("displayName userName profileImage address bio")
        .skip(opts.skip)
        .limit(opts.limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    const me = await UserModel.findById(callerId).select("following").lean();
    const followingSet = new Set((me?.following || []).map((id: any) => id.toString()));

    return {
      items: items.map((u: any) => ({
        ...u,
        isFollowing: followingSet.has(u._id.toString()),
      })),
      total,
    };
  },

  // ── Follow ───────────────────────────────────────────────────────────────

  /** Toggle follow relation: caller follows target if not yet, otherwise unfollow. */
  async toggleFollow(callerId: string, targetId: string) {
    if (callerId === targetId) {
      throw new ApiError(400, "Cannot follow yourself", "FOLLOW_SELF");
    }
    if (!mongoose.isValidObjectId(targetId)) {
      throw new ApiError(400, "Invalid target user id", "INVALID_USER_ID");
    }

    const target = await UserModel.findById(targetId).select("_id").lean();
    if (!target) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

    const targetObjId = new mongoose.Types.ObjectId(targetId);

    // Try to add (only succeeds when not already following)
    const added = await UserModel.findOneAndUpdate(
      { _id: callerId, following: { $ne: targetObjId } },
      { $addToSet: { following: targetObjId } },
      { new: true, projection: { _id: 1 } }
    );

    if (added) {
      const followersCount = await UserModel.countDocuments({ following: targetObjId });
      UserModel.findById(callerId).select("displayName").lean().then((caller) => {
        const followerName = caller?.displayName || "Someone";
        NotificationService.sendNotification({
          userId: targetId,
          type: "FOLLOW",
          title: "New Follower",
          message: `${followerName} started following you`,
          metadata: { followerId: callerId },
        }).catch(() => {});
      }).catch(() => {});

      return { following: true, followersCount };
    }

    // Not added → already following → unfollow
    await UserModel.findOneAndUpdate(
      { _id: callerId },
      { $pull: { following: targetObjId } },
      { projection: { _id: 1 } }
    );
    const followersCount = await UserModel.countDocuments({ following: targetObjId });
    return { following: false, followersCount };
  },

  /** Users who follow `userId`. */
  async getFollowers(userId: string, callerId: string, opts: { skip: number; limit: number }) {
    const targetObjId = new mongoose.Types.ObjectId(userId);
    const [items, total] = await Promise.all([
      UserModel.find({ following: targetObjId })
        .select("displayName userName profileImage address bio")
        .skip(opts.skip)
        .limit(opts.limit)
        .lean(),
      UserModel.countDocuments({ following: targetObjId }),
    ]);

    const me = await UserModel.findById(callerId).select("following").lean();
    const followingSet = new Set((me?.following || []).map((id: any) => id.toString()));

    return {
      items: items.map((u: any) => ({
        ...u,
        isFollowing: followingSet.has(u._id.toString()),
      })),
      total,
    };
  },

  /** Users that `userId` follows. */
  async getFollowing(userId: string, callerId: string, opts: { skip: number; limit: number }) {
    const user = await UserModel.findById(userId).select("following").lean();
    if (!user) return { items: [], total: 0 };

    const followingIds = user.following || [];
    const total = followingIds.length;
    const slice = followingIds.slice(opts.skip, opts.skip + opts.limit);

    const items = await UserModel.find({ _id: { $in: slice } })
      .select("displayName userName profileImage address bio")
      .lean();

    // Preserve original order (newest first based on insertion order)
    const order = new Map(slice.map((id: any, idx: number) => [id.toString(), idx]));
    items.sort((a: any, b: any) => (order.get(a._id.toString())! - order.get(b._id.toString())!));

    const me = await UserModel.findById(callerId).select("following").lean();
    const followingSet = new Set((me?.following || []).map((id: any) => id.toString()));

    return {
      items: items.map((u: any) => ({
        ...u,
        isFollowing: followingSet.has(u._id.toString()),
      })),
      total,
    };
  },

  /** Cheap lookup for the feed `scope=following` filter. */
  async getFollowingIds(userId: string): Promise<mongoose.Types.ObjectId[]> {
    const me = await UserModel.findById(userId).select("following").lean();
    return (me?.following ?? []) as mongoose.Types.ObjectId[];
  },
};
