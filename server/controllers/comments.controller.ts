import { Request, Response } from "express";
import { ok } from "../utils/apiResponse";
import { CommentsService } from "../services/comments.service";

type AuthedRequest = Request & { user: { userId: string } };

export class CommentsController {
  static async list(req: Request, res: Response) {
    const postId = req.params.postId;
    const comments = await CommentsService.list(postId);
    return ok(res, { items: comments, total: comments.length });
  }

  static async create(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const postId = req.params.postId;
    const { text } = req.body as { text: string };
    const created = await CommentsService.create(userId, postId, text);
    return ok(res, created, 201);
  }

  static async remove(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const commentId = req.params.commentId;
    const result = await CommentsService.remove(userId, commentId);
    return ok(res, result);
  }
}
