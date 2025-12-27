import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthService } from '../../services/auth.service';
import User, { IUser } from '../../models/user.model';
import mongoose from 'mongoose';

describe('AuthService Tests', () => {
    let userName: string;
    let userEmail: string;

    beforeEach(() => {
        userName = `testuser-${Date.now()}`;
        userEmail = `testuser${Date.now()}@example.com`;
        jest.clearAllMocks();
    });

    describe('register', () => {
        it('should register a new user successfully', async () => {
            const result = await AuthService.register({
                userName,
                email: userEmail,
                password: 'securePassword123',
                isGoogleUser: false
            });

            expect(result.status).toBe(201);
            expect(result.data.message).toBe('User registered successfully');
            expect(result.data.user).toHaveProperty('_id');
            expect(result.data.user.userName).toBe(userName);
            expect(result.data.user.email).toBe(userEmail);
        });

        it('should throw error if user already exists', async () => {
            await User.create<Partial<IUser>>({
                userName,
                email: userEmail,
                password: 'securePassword123',
            });

            await expect(AuthService.register({
                userName: 'anotheruser',
                email: userEmail,
                password: 'securePassword123',
                isGoogleUser: false
            })).rejects.toThrow('User already exists');
        });

        it('should register a Google user without hashing password', async () => {
            const result = await AuthService.register({
                userName,
                email: userEmail,
                password: 'NotNeededToSignInWithGoogle',
                isGoogleUser: true,
                profileImage: 'https://example.com/image.jpg'
            });

            expect(result.status).toBe(201);
            expect(result.data.message).toBe('User registered successfully');
        });
    });

    describe('login', () => {
        it('should login successfully with valid credentials', async () => {
            const password = await bcrypt.hash('securePassword123', 10);
            await User.create<Partial<IUser>>({
                userName,
                email: userEmail,
                password,
            });

            const result = await AuthService.login({
                email: userEmail,
                password: 'securePassword123',
                isGoogleUser: false
            });

            expect(result.status).toBe(200);
            expect(result.data.message).toBe('Login successful');
            expect(result.data).toHaveProperty('accessToken');
            expect(result.data).toHaveProperty('refreshToken');
        });

        it('should throw error for invalid email', async () => {
            await expect(AuthService.login({
                email: 'nonexistent@example.com',
                password: 'securePassword123',
                isGoogleUser: false
            })).rejects.toThrow('Invalid credentials');
        });

        it('should throw error for invalid password', async () => {
            const password = await bcrypt.hash('securePassword123', 10);
            await User.create<Partial<IUser>>({
                userName,
                email: userEmail,
                password,
            });

            await expect(AuthService.login({
                email: userEmail,
                password: 'wrongPassword',
                isGoogleUser: false
            })).rejects.toThrow('Invalid credentials');
        });

        it('should login Google user without password validation', async () => {
            const password = await bcrypt.hash('NotNeededToSignInWithGoogle', 10);
            await User.create<Partial<IUser>>({
                userName,
                email: userEmail,
                password,
            });

            const result = await AuthService.login({
                email: userEmail,
                password: 'NotNeededToSignInWithGoogle',
                isGoogleUser: true
            });

            expect(result.status).toBe(200);
            expect(result.data).toHaveProperty('accessToken');
        });
    });

    describe('logout', () => {
        it('should logout successfully', async () => {
            const refreshToken = jwt.sign({ userId: new mongoose.Types.ObjectId() }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' as jwt.SignOptions['expiresIn'] });
            const user = await User.create<Partial<IUser>>({
                userName,
                email: userEmail,
                password: 'securePassword123',
                refreshToken,
            });

            const result = await AuthService.logout((user._id as mongoose.Types.ObjectId).toString());

            expect(result.status).toBe(200);
            expect(result.data.message).toBe('Logged out successfully');

            const updatedUser = await User.findById(user._id).select('+refreshToken');
            expect(updatedUser?.refreshToken).toBeNull();
        });

        it('should throw error for invalid user id', async () => {
            const invalidUserId = new mongoose.Types.ObjectId().toString();
            await expect(AuthService.logout(invalidUserId)).rejects.toThrow('Invalid token');
        });
    });

    describe('refreshToken', () => {
        it('should refresh token successfully', async () => {
            const userId = new mongoose.Types.ObjectId();
            const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' as jwt.SignOptions['expiresIn'] });
            
            await User.create<Partial<IUser>>({
                _id: userId,
                userName,
                email: userEmail,
                password: 'securePassword123',
                refreshToken,
            });

            const result = await AuthService.refreshToken(refreshToken);

            expect(result.status).toBe(200);
            expect(result.data).toHaveProperty('accessToken');
        });

        it('should throw error for invalid refresh token', async () => {
            await expect(AuthService.refreshToken('invalidToken')).rejects.toThrow();
        });

        it('should throw error for mismatched refresh token', async () => {
            const userId = new mongoose.Types.ObjectId();
            const differentUserId = new mongoose.Types.ObjectId();
            const storedRefreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' as jwt.SignOptions['expiresIn'] });
            const differentRefreshToken = jwt.sign({ userId: differentUserId }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' as jwt.SignOptions['expiresIn'] });
            
            await User.create<Partial<IUser>>({
                _id: userId,
                userName,
                email: userEmail,
                password: 'securePassword123',
                refreshToken: storedRefreshToken,
            });

            await expect(AuthService.refreshToken(differentRefreshToken)).rejects.toThrow('Invalid refresh token');
        });
    });
});

