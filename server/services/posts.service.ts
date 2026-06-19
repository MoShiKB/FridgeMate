import mongoose from "mongoose";
import { ApiError } from "../utils/errors";
import { PostModel } from "../models/post.model";
import { CommentModel } from "../models/comment.model";
import { UserService } from "./user.service";
import { NotificationService } from "./notification.service";

export class PostsService {
  static async create(userId: string, payload: any) {
    console.log('[PostsService.create] location payload:', JSON.stringify(payload.location ?? null));
    const doc = await PostModel.create({
      authorUserId: new mongoose.Types.ObjectId(userId),
      title: payload.title,
      text: payload.text,
      mediaUrls: payload.mediaUrls ?? [],
      likes: [],
      recipeId: payload.recipeId ? new mongoose.Types.ObjectId(payload.recipeId) : null,
      location: payload.location
        ? {
            type: "Point",
            coordinates: [payload.location.lng, payload.location.lat],
            placeName: payload.location.placeName,
          }
        : null,
    });
    return doc.toObject();
  }

  static async list(opts: {
    skip: number;
    limit: number;
    userId?: string;
    authorId?: string;
    scope?: "all" | "following";
    near?: { lat: number; lng: number; radiusKm?: number };
  }) {
    const q: any = {};
    if (opts.authorId) {
      q.authorUserId = new mongoose.Types.ObjectId(opts.authorId);
    }
    let scopedFollowingIds: mongoose.Types.ObjectId[] | null = null;
    if (opts.scope === "following" && !opts.authorId) {
      if (!opts.userId) {
        // Following scope requires an authenticated caller
        return { items: [], total: 0 };
      }
      scopedFollowingIds = await UserService.getFollowingIds(opts.userId);
      if (scopedFollowingIds.length === 0) {
        return { items: [], total: 0 };
      }
      q.authorUserId = { $in: scopedFollowingIds };
    }
    if (opts.near?.lat !== undefined && opts.near?.lng !== undefined) {
      const radiusMeters = (opts.near.radiusKm ?? 50) * 1000;
      const EARTH_RADIUS_METERS = 6378137;
      q.location = {
        $geoWithin: {
          $centerSphere: [
            [opts.near.lng, opts.near.lat],
            radiusMeters / EARTH_RADIUS_METERS,
          ],
        },
      };
    }

    const [items, total] = await Promise.all([
      PostModel.find(q)
        .populate("authorUserId", "displayName profileImage address")
        .populate("recipeId", "title description cookingTime difficulty imageUrl nutrition")
        .sort({ createdAt: -1 })
        .skip(opts.skip)
        .limit(opts.limit)
        .lean(),
      PostModel.countDocuments(q),
    ]);

    const postIds = items.map((p: any) => p._id);
    const commentCounts = await CommentModel.aggregate([
      { $match: { postId: { $in: postIds } } },
      { $group: { _id: "$postId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(commentCounts.map((c: any) => [c._id.toString(), c.count]));

    let followingSet: Set<string> = new Set();
    if (opts.userId) {
      const followingIds =
        scopedFollowingIds ?? (await UserService.getFollowingIds(opts.userId));
      followingSet = new Set(followingIds.map((id: any) => id.toString()));
    }

    return {
      items: items.map((post: any) => {
        const authorIdStr = post.authorUserId?._id?.toString();
        return {
          ...post,
          commentsCount: countMap.get(post._id.toString()) || 0,
          likesCount: post.likes?.length || 0,
          isLiked: opts.userId ? (post.likes || []).some((id: any) => id.toString() === opts.userId) : false,
          isOwner: opts.userId ? authorIdStr === opts.userId : false,
          isFollowingAuthor: !!(opts.userId && authorIdStr && authorIdStr !== opts.userId && followingSet.has(authorIdStr)),
        };
      }),
      total,
    };
  }

  static async update(userId: string, postId: string, patch: any) {
    const post = await PostModel.findById(postId);
    if (!post) throw new ApiError(404, "Post not found", "POST_NOT_FOUND");
    if (post.authorUserId.toString() !== userId) throw new ApiError(403, "Not allowed", "FORBIDDEN");

    if (patch.title !== undefined) post.title = patch.title;
    if (patch.text !== undefined) post.text = patch.text;
    if (patch.mediaUrls !== undefined) post.mediaUrls = patch.mediaUrls;

    if (patch.location !== undefined) {
      if (patch.location === null) {
        (post as any).location = null;
      } else {
        (post as any).location = {
          type: "Point",
          coordinates: [patch.location.lng, patch.location.lat],
          placeName: patch.location.placeName,
        };
      }
    }

    await post.save();
    return post.toObject();
  }

  static async remove(userId: string, postId: string) {
    const post = await PostModel.findById(postId);
    if (!post) throw new ApiError(404, "Post not found", "POST_NOT_FOUND");
    if (post.authorUserId.toString() !== userId) throw new ApiError(403, "Not allowed", "FORBIDDEN");

    await CommentModel.deleteMany({ postId: post._id });
    await post.deleteOne();
    return { ok: true };
  }

  static async toggleLike(userId: string, postId: string) {
    const uid = new mongoose.Types.ObjectId(userId);

    const added = await PostModel.findOneAndUpdate(
      { _id: postId, likes: { $ne: uid } },
      { $addToSet: { likes: uid } },
      { new: true }
    );

    if (added) {
      if (added.authorUserId.toString() !== userId) {
        NotificationService.sendNotification({
          userId: added.authorUserId.toString(),
          type: "POST_LIKE",
          title: "New Like",
          message: "Someone liked your post",
          metadata: { postId },
        }).catch(() => {});
      }
      return { liked: true, likesCount: added.likes.length };
    }

    const removed = await PostModel.findOneAndUpdate(
      { _id: postId, likes: uid },
      { $pull: { likes: uid } },
      { new: true }
    );

    if (!removed) throw new ApiError(404, "Post not found", "POST_NOT_FOUND");
    return { liked: false, likesCount: removed.likes.length };
  }
}
