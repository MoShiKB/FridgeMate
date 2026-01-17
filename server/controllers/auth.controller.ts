import { Request, Response, NextFunction } from "express";
import { AuthService, RegisterData } from "../services/auth.service";

export const AuthController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { userName, displayName, email, password, profileImage } = req.body;

      const payload: RegisterData = {
        userName,
        displayName,
        email,
        password,
        profileImage,
      };

      const response = await AuthService.register(payload);
      return res.status(response.status).json(response.data);
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const response = await AuthService.login({ email, password });
      return res.status(response.status).json(response.data);
    } catch (err) {
      next(err);
    }
  },

  async handleGoogleCallback(req: Request, res: Response, next: NextFunction) {
    const redirectRoute = `/auth/google/callback`;
    const googleUser = req.user as { email?: string; userName?: string; profileImage?: string };

    if (!googleUser?.email) {
      return next(new Error("Google login failed: missing email"));
    }

    try {
      const response = await AuthService.loginWithGoogle(
        googleUser.email,
        googleUser.userName,
        googleUser.profileImage
      );

      return res.redirect(
        `${redirectRoute}?accessToken=${response.data.accessToken}&refreshToken=${response.data.refreshToken}`
      );
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.body;
      const response = await AuthService.logout(userId);
      return res.status(response.status).json(response.data);
    } catch (err) {
      next(err);
    }
  },

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const response = await AuthService.refreshToken(refreshToken);
      return res.status(response.status).json(response.data);
    } catch (err) {
      next(err);
    }
  },
};
