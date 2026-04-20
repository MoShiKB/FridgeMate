import mongoose from "mongoose";
import { ApiError } from "../utils/errors";
import { PostModel } from "../models/post.model";
import { CommentModel } from "../models/comment.model";

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
    near?: { lat: number; lng: number; radiusKm?: number };
  }) {
    const q: any = {};
    if (opts.authorId) {
      q.authorUserId = new mongoose.Types.ObjectId(opts.authorId);
    }
    if (opts.near?.lat !== undefined && opts.near?.lng !== undefined) {
      const radiusMeters = (opts.near.radiusKm ?? 50) * 1000;
      q.location = {
        $near: {
          $geometry: { type: "Point", coordinates: [opts.near.lng, opts.near.lat] },
          $maxDistance: radiusMeters,
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

    return {
      items: items.map((post: any) => ({
        ...post,
        commentsCount: countMap.get(post._id.toString()) || 0,
        likesCount: post.likes?.length || 0,
        isLiked: opts.userId ? (post.likes || []).some((id: any) => id.toString() === opts.userId) : false,
        isOwner: opts.userId ? post.authorUserId?._id?.toString() === opts.userId : false,
      })),
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
