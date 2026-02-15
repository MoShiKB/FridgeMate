import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service";

export const UserController = {
  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id;
      const user = await UserService.getUserById(userId);

      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json(user);
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.body.userId as string;
      const { userName, profileImage } = req.body;

      const updatedUser = await UserService.updateProfile(userId, { userName, profileImage });
      if (!updatedUser) return res.status(404).json({ message: "User not found" });

      return res.json(updatedUser);
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({ message: "Duplicate field (email/userName already exists)" });
      }
      next(err);
    }
  },

  async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await UserService.getAllUsers();
      return res.json(users);
    } catch (err) {
      next(err);
    }
  },
};
