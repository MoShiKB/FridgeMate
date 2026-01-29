import UserModel, { IUser } from "../models/user.model";

export const UserService = {
  async getUserById(userId: string) {
    return UserModel.findById(userId).lean();
  },

  async getUserByEmail(email: string) {
    return UserModel.findOne({ email: email.toLowerCase().trim() }).select("+password +refreshToken").exec();
  },

  async getUserByUserName(userName: string) {
    return UserModel.findOne({ userName: userName.toLowerCase().trim() }).exec();
  },

  async updateProfile(userId: string, userData: Partial<IUser>) {
    const update: any = {};

    if (typeof userData.userName === "string") {
      update.userName = userData.userName.trim().toLowerCase();
    }
    if (typeof (userData as any).profileImage === "string") {
      update.profileImage = (userData as any).profileImage.trim();
    }
    if (typeof userData.displayName === "string") {
      update.displayName = userData.displayName.trim();
    }
    if (userData.age !== undefined) update.age = userData.age;
    if (userData.address !== undefined) update.address = userData.address;
    if (userData.allergies !== undefined) update.allergies = userData.allergies;
    if (userData.dietPreference !== undefined) update.dietPreference = userData.dietPreference;

    return UserModel.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true }).lean();
  },

  async getAllUsers() {
    return UserModel.find({}).select("-password -refreshToken").lean();
  },
};
