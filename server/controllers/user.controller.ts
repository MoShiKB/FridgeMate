import { Request, Response } from "express";
import { UserService } from "../services/user.service";

export const UserController = {
  async getUserById(req: Request, res: Response) {
    const userId = req.params.id;
    const user = await UserService.getUserById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  },

  async updateProfile(req: Request, res: Response) {
    const userId = req.params.id as string;
    const { userName, profileImage, displayName, address, allergies, dietPreference } = req.body;

    try {
      const updatedUser = await UserService.updateProfile(userId, { userName, profileImage, displayName, address, allergies, dietPreference });
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
};
