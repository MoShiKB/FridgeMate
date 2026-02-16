import { Request, Response } from "express";
import { items as itemsRes, ok } from "../utils/apiResponse";
import { parsePageLimit } from "../utils/pagination";
import { PostsService } from "../services/posts.service";

type AuthedRequest = Request & { user: { userId: string } };

export class PostsController {
  static async create(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const created = await PostsService.create(userId, req.body);
    return ok(res, created, 201);
  }

  static async list(req: Request, res: Response) {
    const { page, limit, skip } = parsePageLimit(req.query);

    const lat = (req.query as any).lat;
    const lng = (req.query as any).lng;
    const radiusKm = (req.query as any).radiusKm;

    const near =
      lat !== undefined && lng !== undefined
        ? { lat: Number(lat), lng: Number(lng), radiusKm: radiusKm ? Number(radiusKm) : undefined }
        : undefined;

    const result = await PostsService.list({ skip, limit, near });
    return itemsRes(res, { items: result.items, total: result.total, page, limit });
  }

  static async update(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const postId = req.params.post_id;
    const updated = await PostsService.update(userId, postId, req.body);
    return ok(res, updated);
  }

  static async remove(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const postId = req.params.post_id;
    const result = await PostsService.remove(userId, postId);
    return ok(res, result);
  }
}
