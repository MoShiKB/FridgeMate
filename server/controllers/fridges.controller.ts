import { Request, Response } from "express";
import { ok, items as itemsRes } from "../utils/apiResponse";
import { FridgesService } from "../services/fridges.service";

export class FridgesController {
  static async create(req: Request, res: Response) {
    const userId = req.user!.userId;
    const fridge = await FridgesService.createFridge(userId, (req.body as any).name);
    return ok(res, { fridgeId: fridge._id.toString(), inviteCode: fridge.inviteCode }, 201);
  }

  static async join(req: Request, res: Response) {
    const userId = req.user!.userId;
    const fridge = await FridgesService.joinByInviteCode(userId, (req.body as any).inviteCode);
    return ok(res, { fridgeId: fridge._id.toString() });
  }

  static async leave(req: Request, res: Response) {
    const userId = req.user!.userId;
    const result = await FridgesService.leaveCurrentFridge(userId);
    return ok(res, result);
  }

  static async me(req: Request, res: Response) {
    const userId = req.user!.userId;
    const fridge = await FridgesService.getMyFridge(userId);
    return ok(res, fridge);
  }

  static async members(req: Request, res: Response) {
    const userId = req.user!.userId;
    const members = await FridgesService.getMyFridgeMembers(userId);
    
    return itemsRes(res, { items: members, total: members.length, page: 1, limit: members.length });
  }
}
