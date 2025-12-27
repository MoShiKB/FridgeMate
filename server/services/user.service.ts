import User, { IUser } from '../models/user.model';

export const UserService = {
    async getUserById(userId: string) {
        const user: IUser | null = await User.findById(userId);
        return user;
    },

    async getUserByEmail(email: string) {
        const user: IUser | null = await User.findOne({ email }).select('+password').exec();
        return user;
    },

    async updateProfile(userId: string, userData: Partial<IUser>) {
        return User.findByIdAndUpdate(userId, {
            profileImage: userData.profileImage,
            userName: userData.userName,
        }, { new: true });
    },

    async getAllUsers() {
        return User.find({}).select('-password -refreshToken');
    }
};

