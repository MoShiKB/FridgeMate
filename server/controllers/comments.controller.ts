import { Request, Response } from "express";
import { ok } from "../utils/apiResponse";
import { CommentsService } from "../services/comments.service";

import { AuthedRequest } from "../middlewares/auth";

export class CommentsController {
  static async list(req: Request, res: Response) {
    const postId = req.params.postId;
    const userId = (req as AuthedRequest).user?.userId;
    const comments = await CommentsService.list(postId, userId);
    return ok(res, { items: comments, total: comments.length });
  }

  static async create(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const postId = req.params.postId;
    const { text } = req.body as { text: string };
    const created = await CommentsService.create(userId, postId, text);
    return ok(res, created, 201);
  }

  static async update(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const commentId = req.params.commentId;
    const { text } = req.body as { text: string };
    const updated = await CommentsService.update(userId, commentId, text);
    return ok(res, updated);
  }

  static async remove(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const commentId = req.params.commentId;
    const result = await CommentsService.remove(userId, commentId);
    return ok(res, result);
  }
}
