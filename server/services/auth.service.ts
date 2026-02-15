import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import UserModel, { IUser } from "../models/user.model";

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

function signAccessToken(user: any) {
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
    if (exist) throw new Error("User already exists");

    const salt = await bcrypt.genSalt(10);
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
    if (!user || !user.password) throw new Error("Invalid credentials");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Invalid credentials");

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
      const uname = userName?.trim().toLowerCase();
      const displayName = userName?.trim() || normalizedEmail.split("@")[0];

      const randomPass = await bcrypt.hash(String(Date.now()) + normalizedEmail, 10);

      user = await UserModel.create({
        email: normalizedEmail,
        userName: uname,
        displayName,
        password: randomPass,
        profileImage,
        allergies: [],
        dietPreference: "NONE",
        activeFridgeId: null,
      });
    } else {
      const updates: any = {};
      if (userName && user.userName !== userName.trim().toLowerCase()) updates.userName = userName.trim().toLowerCase();
      if (profileImage && user.profileImage !== profileImage) updates.profileImage = profileImage;
      if (Object.keys(updates).length) {
        await UserModel.updateOne({ _id: user._id }, { $set: updates });
      }
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user._id.toString());

    user.refreshToken = refreshToken;
    await user.save();

    return { status: 200, data: { message: "Login successful", accessToken, refreshToken } };
  },

  async logout(userId: string) {
    const user = await UserModel.findById(userId).select("+refreshToken").exec();
    if (!user) throw new Error("Invalid token");

    user.refreshToken = null;
    await user.save();
    return { status: 200, data: { message: "Logged out successfully" } };
  },

  async refreshToken(refreshToken: string) {
    const decodedToken = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as { userId: string };

    const user = await UserModel.findById(decodedToken.userId).select("+refreshToken").exec();
    if (!user || user.refreshToken !== refreshToken) throw new Error("Invalid refresh token");

    const newAccessToken = signAccessToken(user);
    return { status: 200, data: { accessToken: newAccessToken } };
  },
};
