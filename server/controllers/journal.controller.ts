import { Request, Response } from "express";
import { items as itemsRes, ok } from "../utils/apiResponse";
import { parsePageLimit } from "../utils/pagination";
import { JournalService } from "../services/journal.service";
import { AuthedRequest } from "../middlewares/auth";

export class JournalController {
  static async create(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const created = await JournalService.create(userId, req.body);
    return ok(res, created, 201);
  }

  static async list(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const { page, limit, skip } = parsePageLimit(req.query);
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = await JournalService.list(userId, { skip, limit, startDate, endDate });
    return itemsRes(res, { items: result.items, total: result.total, page, limit });
  }

  static async getById(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const id = req.params.id;
    const entry = await JournalService.getById(userId, id);
    return ok(res, entry);
  }

  static async update(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const id = req.params.id;
    const updated = await JournalService.update(userId, id, req.body);
    return ok(res, updated);
  }

  static async remove(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const id = req.params.id;
    const result = await JournalService.remove(userId, id);
    return ok(res, result);
  }
}
