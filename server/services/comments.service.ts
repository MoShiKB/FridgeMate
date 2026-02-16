import mongoose from "mongoose";
import { ApiError } from "../utils/errors";
import { CommentModel } from "../models/comment.model";
import { PostModel } from "../models/post.model";

export class CommentsService {
  static async list(postId: string) {
    const post = await PostModel.findById(postId).lean();
    if (!post) throw new ApiError(404, "Post not found", "POST_NOT_FOUND");

    const comments = await CommentModel.find({ postId: new mongoose.Types.ObjectId(postId) })
      .sort({ createdAt: 1 })
      .lean();

    return comments;
  }

  static async create(userId: string, postId: string, text: string) {
    const post = await PostModel.findById(postId).lean();
    if (!post) throw new ApiError(404, "Post not found", "POST_NOT_FOUND");

    const doc = await CommentModel.create({
      postId: new mongoose.Types.ObjectId(postId),
      authorUserId: new mongoose.Types.ObjectId(userId),
      text,
    });

    return doc.toObject();
  }

  static async remove(userId: string, commentId: string) {
    const comment = await CommentModel.findById(commentId);
    if (!comment) throw new ApiError(404, "Comment not found", "COMMENT_NOT_FOUND");

    if (comment.authorUserId.toString() !== userId) throw new ApiError(403, "Not allowed", "FORBIDDEN");
    await comment.deleteOne();
    return { ok: true };
  }
}
