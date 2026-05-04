import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import UserModel, { IUser } from "../models/user.model";
import { sendResetCodeEmail } from "../config/email";
import { ApiError } from "../utils/errors";

const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);

let googleOAuthClient: OAuth2Client | null = null;
function getGoogleOAuthClient(): OAuth2Client {
  if (!googleOAuthClient) {
    googleOAuthClient = new OAuth2Client();
  }
  return googleOAuthClient;
}

export interface RegisterData {
  userName?: string;
  displayName?: string;
  email: string;
  password: string;
  profileImage?: string;
}

interface LoginData {
  email: string;
  password: string;
}

function signAccessToken(user: Pick<IUser, "userName" | "email" | "role" | "profileImage"> & { _id: unknown }) {
  return jwt.sign(
    {
      userId: user._id,
      userName: user.userName,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
  );
}

function signRefreshToken(userId: string) {
  return jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
  );
}

export const AuthService = {
  async register(data: RegisterData) {
    const email = data.email.toLowerCase().trim();

    const exist = await UserModel.findOne({ email }).lean();
    if (exist) throw new ApiError(409, "User already exists");

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const userName = data.userName?.trim().toLowerCase();
    const displayName = data.displayName?.trim() || (userName || email.split("@")[0]);

    const newUser = await UserModel.create({
      email,
      userName,
      displayName,
      password: hashedPassword,
      profileImage: data.profileImage,
      allergies: [],
      dietPreference: "NONE",
      activeFridgeId: null,
    });

    const userObj = newUser.toObject();
    delete (userObj as any).password;
    delete (userObj as any).refreshToken;

    return { status: 201, data: { message: "User registered successfully", user: userObj } };
  },

  async login({ email, password }: LoginData) {
    const normalizedEmail = email.toLowerCase().trim();

    // חשוב: select("+password") כי password מוגדר select:false במודל
    const user = await UserModel.findOne({ email: normalizedEmail }).select("+password").exec();
    if (!user || !user.password) throw new ApiError(401, "Invalid credentials");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new ApiError(401, "Invalid credentials");

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user._id.toString());

    user.refreshToken = refreshToken;
    await user.save();

    return { status: 200, data: { message: "Login successful", accessToken, refreshToken } };
  },

  // Login for Google: בלי סיסמה בכלל
  async loginWithGoogle(email: string, userName?: string, profileImage?: string) {
    const normalizedEmail = email.toLowerCase().trim();

    let user = await UserModel.findOne({ email: normalizedEmail }).exec();

    if (!user) {
      const displayName = userName?.trim() || normalizedEmail.split("@")[0];
      const randomPass = await bcrypt.hash(String(Date.now()) + normalizedEmail, SALT_ROUNDS);
      user = await UserModel.create({
        email: normalizedEmail,
        displayName,
        password: randomPass,
        profileImage,
        allergies: [],
        dietPreference: "NONE",
        activeFridgeId: null,
      });
    } else {
      if (profileImage && !user.profileImage) {
        user.profileImage = profileImage;
      }
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user._id.toString());

    user.refreshToken = refreshToken;
    await user.save();

    return { status: 200, data: { message: "Login successful", accessToken, refreshToken } };
  },

  async loginWithGoogleIdToken(idToken: string) {
    const audience = process.env.OAUTH_CLIENT_ID;
    if (!audience) {
      throw new ApiError(500, "Google login is not configured on the server");
    }

    let payload: import("google-auth-library").TokenPayload | undefined;
    try {
      const ticket = await getGoogleOAuthClient().verifyIdToken({
        idToken,
        audience,
      });
      payload = ticket.getPayload();
    } catch (_err) {
      throw new ApiError(401, "Invalid Google ID token");
    }

    if (!payload?.email) {
      throw new ApiError(401, "Invalid Google ID token");
    }

    if (payload.email_verified === false) {
      throw new ApiError(401, "Google account email is not verified");
    }

    return AuthService.loginWithGoogle(payload.email, payload.name, payload.picture);
  },

  async logout(userId: string) {
    const user = await UserModel.findById(userId).select("+refreshToken").exec();
    if (!user) throw new ApiError(401, "Invalid token");

    user.refreshToken = null;
    await user.save();
    return { status: 200, data: { message: "Logged out successfully" } };
  },

  async refreshToken(refreshToken: string) {
    const decodedToken = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as { userId: string };

    const user = await UserModel.findById(decodedToken.userId).select("+refreshToken").exec();
    if (!user || user.refreshToken !== refreshToken) throw new ApiError(401, "Invalid refresh token");

    const newAccessToken = signAccessToken(user);
    return { status: 200, data: { accessToken: newAccessToken } };
  },

  async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await UserModel.findOne({ email: normalizedEmail })
      .select("+resetPasswordToken +resetPasswordExpires")
      .exec();

    if (!user) throw new ApiError(404, "No account found with this email");

    const code = crypto.randomInt(100_000, 999_999).toString();
    const hashedCode = await bcrypt.hash(code, SALT_ROUNDS);

    user.resetPasswordToken = hashedCode;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save({ validateModifiedOnly: true });

    await sendResetCodeEmail(normalizedEmail, code);

    return { status: 200, data: { message: "Reset code sent to your email" } };
  },

  async resetPassword(email: string, code: string, newPassword: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await UserModel.findOne({ email: normalizedEmail })
      .select("+resetPasswordToken +resetPasswordExpires +password")
      .exec();

    if (!user || !user.resetPasswordToken || !user.resetPasswordExpires) {
      throw new ApiError(400, "No reset request found. Please request a new code.");
    }

    if (user.resetPasswordExpires < new Date()) {
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save({ validateModifiedOnly: true });
      throw new ApiError(400, "Reset code has expired. Please request a new one.");
    }

    const isMatch = await bcrypt.compare(code, user.resetPasswordToken);
    if (!isMatch) throw new ApiError(400, "Invalid reset code");

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save({ validateModifiedOnly: true });

    return { status: 200, data: { message: "Password reset successfully" } };
  },
};
