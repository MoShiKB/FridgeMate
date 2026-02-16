import mongoose from "mongoose";
import { ApiError } from "../utils/errors";
import { PostModel } from "../models/post.model";

export class PostsService {
  static async create(userId: string, payload: any) {
    const doc = await PostModel.create({
      authorUserId: new mongoose.Types.ObjectId(userId),
      text: payload.text,
      mediaUrls: payload.mediaUrls ?? [],
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

  static async list(opts: { skip: number; limit: number; near?: { lat: number; lng: number; radiusKm?: number } }) {
    const q: any = {};
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
      PostModel.find(q).sort({ createdAt: -1 }).skip(opts.skip).limit(opts.limit).lean(),
      PostModel.countDocuments(q),
    ]);

    return { items, total };
  }

  static async update(userId: string, postId: string, patch: any) {
    const post = await PostModel.findById(postId);
    if (!post) throw new ApiError(404, "Post not found", "POST_NOT_FOUND");
    if (post.authorUserId.toString() !== userId) throw new ApiError(403, "Not allowed", "FORBIDDEN");

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

    await post.deleteOne();
    return { ok: true };
  }
}
