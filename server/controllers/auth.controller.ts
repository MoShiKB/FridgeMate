import { Request, Response } from "express";
import { AuthedRequest } from "../middlewares/auth";
import { AuthService, RegisterData } from "../services/auth.service";

export const AuthController = {
  async register(req: Request, res: Response) {
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
  },

  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const response = await AuthService.login({ email, password });
    return res.status(response.status).json(response.data);
  },

  async loginWithGoogleAndroid(req: Request, res: Response) {
    const { idToken } = req.body;
    const response = await AuthService.loginWithGoogleIdToken(idToken);
    return res.status(response.status).json(response.data);
  },

  async handleGoogleCallback(req: Request, res: Response) {
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const googleUser = req.user as { email?: string; userName?: string; profileImage?: string };

    if (!googleUser?.email) {
      throw new Error("Google login failed: missing email");
    }

    const response = await AuthService.loginWithGoogle(
      googleUser.email,
      googleUser.userName,
      googleUser.profileImage
    );

    const { accessToken, refreshToken } = response.data;
    const params = new URLSearchParams({ accessToken, refreshToken });
    return res.redirect(`${clientUrl}/auth/google/callback?${params}`);
  },

  async logout(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const response = await AuthService.logout(userId);
    return res.status(response.status).json(response.data);
  },

  async refreshToken(req: Request, res: Response) {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }
    const response = await AuthService.refreshToken(refreshToken);
    return res.status(response.status).json(response.data);
  },

  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;
    const response = await AuthService.forgotPassword(email);
    return res.status(response.status).json(response.data);
  },

  async resetPassword(req: Request, res: Response) {
    const { email, code, newPassword } = req.body;
    const response = await AuthService.resetPassword(email, code, newPassword);
    return res.status(response.status).json(response.data);
  },
};
