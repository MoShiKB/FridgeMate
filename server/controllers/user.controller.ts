import { Request, Response } from "express";
import { UserService } from "../services/user.service";
import { AuthedRequest } from "../middlewares/auth";
import { items as itemsRes, ok } from "../utils/apiResponse";
import { parsePageLimit } from "../utils/pagination";

export const UserController = {
  async getUserById(req: Request, res: Response) {
    const userId = req.params.id;
    const callerId = (req as AuthedRequest).user?.userId;
    const user = await UserService.getUserById(userId, callerId);

    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  },

  async updateProfile(req: Request, res: Response) {
    const userId = req.params.id;
    const callerId = (req as AuthedRequest).user.userId;
    if (userId !== callerId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { userName, profileImage, displayName, bio, address, allergies, dietPreference } = req.body;

    try {
      const updatedUser = await UserService.updateProfile(userId, {
        userName,
        profileImage,
        displayName,
        bio,
        address,
        allergies,
        dietPreference,
      });
      if (!updatedUser) return res.status(404).json({ message: "User not found" });
      return res.json(updatedUser);
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({ message: "Duplicate field (email/userName already exists)" });
      }
      throw err;
    }
  },

  async getAllUsers(_req: Request, res: Response) {
    const users = await UserService.getAllUsers();
    return res.json(users);
  },

  async search(req: Request, res: Response) {
    const callerId = (req as AuthedRequest).user.userId;
    const { page, limit, skip } = parsePageLimit(req.query);
    const q = String((req.query as any).q ?? "").trim();
    const result = await UserService.search(q, callerId, { skip, limit });
    return itemsRes(res, { items: result.items, total: result.total, page, limit });
  },

  async toggleFollow(req: Request, res: Response) {
    const callerId = (req as AuthedRequest).user.userId;
    const targetId = req.params.id;
    const result = await UserService.toggleFollow(callerId, targetId);
    return ok(res, result);
  },

  async getFollowers(req: Request, res: Response) {
    const callerId = (req as AuthedRequest).user.userId;
    const userId = req.params.id;
    const { page, limit, skip } = parsePageLimit(req.query);
    const result = await UserService.getFollowers(userId, callerId, { skip, limit });
    return itemsRes(res, { items: result.items, total: result.total, page, limit });
  },

  async getFollowing(req: Request, res: Response) {
    const callerId = (req as AuthedRequest).user.userId;
    const userId = req.params.id;
    const { page, limit, skip } = parsePageLimit(req.query);
    const result = await UserService.getFollowing(userId, callerId, { skip, limit });
    return itemsRes(res, { items: result.items, total: result.total, page, limit });
  },
};
