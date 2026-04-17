import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthService } from '../../services/auth.service';
import User, { IUser } from '../../models/user.model';
import mongoose from 'mongoose';
import * as emailConfig from '../../config/email';

describe('AuthService Tests', () => {
    let userName: string;
    let userEmail: string;
    let counter = 0;

    beforeEach(() => {
        counter++;
        const uid = `${Date.now()}-${counter}`;
        userName = `testuser-${uid}`;
        userEmail = `testuser-${uid}@example.com`;
        jest.clearAllMocks();
    });

    describe('register', () => {
        it('should register a new user successfully', async () => {
            const result = await AuthService.register({
                userName,
                email: userEmail,
                password: 'securePassword123'
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
                displayName: 'Test User',
                email: userEmail,
                password: 'securePassword123',
            });

            await expect(AuthService.register({
                userName: 'anotheruser',
                email: userEmail,
                password: 'securePassword123'
            })).rejects.toThrow('User already exists');
        });

        it('should login a Google user without hashing password', async () => {
            const result = await AuthService.loginWithGoogle(
                userEmail,
                userName,
                'https://example.com/image.jpg'
            );

            expect(result.status).toBe(200);
            expect(result.data.message).toBe('Login successful');
            expect(result.data).toHaveProperty('accessToken');
        });
    });

    describe('login', () => {
        it('should login successfully with valid credentials', async () => {
            const password = await bcrypt.hash('securePassword123', 1);
            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
            });

            const result = await AuthService.login({
                email: userEmail,
                password: 'securePassword123'
            });

            expect(result.status).toBe(200);
            expect(result.data.message).toBe('Login successful');
            expect(result.data).toHaveProperty('accessToken');
            expect(result.data).toHaveProperty('refreshToken');
        });

        it('should throw error for invalid email', async () => {
            await expect(AuthService.login({
                email: 'nonexistent@example.com',
                password: 'securePassword123'
            })).rejects.toThrow('Invalid credentials');
        });

        it('should throw error for invalid password', async () => {
            const password = await bcrypt.hash('securePassword123', 1);
            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
            });

            await expect(AuthService.login({
                email: userEmail,
                password: 'wrongPassword'
            })).rejects.toThrow('Invalid credentials');
        });

        it('should login Google user without password validation', async () => {
            const password = await bcrypt.hash('NotNeededToSignInWithGoogle', 1);
            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
            });

            const result = await AuthService.loginWithGoogle(
                userEmail
            );

            expect(result.status).toBe(200);
            expect(result.data).toHaveProperty('accessToken');
        });
    });

    describe('logout', () => {
        it('should logout successfully', async () => {
            const refreshToken = jwt.sign({ userId: new mongoose.Types.ObjectId() }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' as jwt.SignOptions['expiresIn'] });
            const user = await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
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

    describe('forgotPassword', () => {
        beforeEach(() => {
            jest.spyOn(emailConfig, 'sendResetCodeEmail').mockResolvedValue();
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should generate a reset code and send email', async () => {
            const password = await bcrypt.hash('securePassword123', 1);
            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
            });

            const result = await AuthService.forgotPassword(userEmail);

            expect(result.status).toBe(200);
            expect(result.data.message).toBe('Reset code sent to your email');
            expect(emailConfig.sendResetCodeEmail).toHaveBeenCalledWith(
                userEmail.toLowerCase(),
                expect.stringMatching(/^\d{6}$/)
            );

            const updatedUser = await User.findOne({ email: userEmail })
                .select('+resetPasswordToken +resetPasswordExpires');
            expect(updatedUser?.resetPasswordToken).toBeTruthy();
            expect(updatedUser?.resetPasswordExpires).toBeTruthy();
        });

        it('should throw error for non-existent email', async () => {
            await expect(AuthService.forgotPassword('nonexistent@example.com'))
                .rejects.toThrow('No account found with this email');
        });
    });

    describe('resetPassword', () => {
        it('should reset password with valid code', async () => {
            const password = await bcrypt.hash('oldPassword123', 1);
            const code = '654321';
            const hashedCode = await bcrypt.hash(code, 1);

            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
                resetPasswordToken: hashedCode,
                resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
            } as any);

            const result = await AuthService.resetPassword(userEmail, code, 'newPassword123');

            expect(result.status).toBe(200);
            expect(result.data.message).toBe('Password reset successfully');

            const loginResult = await AuthService.login({ email: userEmail, password: 'newPassword123' });
            expect(loginResult.status).toBe(200);
        });

        it('should throw error for invalid code', async () => {
            const password = await bcrypt.hash('oldPassword123', 1);
            const hashedCode = await bcrypt.hash('123456', 1);

            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
                resetPasswordToken: hashedCode,
                resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
            } as any);

            await expect(AuthService.resetPassword(userEmail, '000000', 'newPassword123'))
                .rejects.toThrow('Invalid reset code');
        });

        it('should throw error for expired code', async () => {
            const password = await bcrypt.hash('oldPassword123', 1);
            const hashedCode = await bcrypt.hash('123456', 1);

            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
                resetPasswordToken: hashedCode,
                resetPasswordExpires: new Date(Date.now() - 1000),
            } as any);

            await expect(AuthService.resetPassword(userEmail, '123456', 'newPassword123'))
                .rejects.toThrow('Reset code has expired. Please request a new one.');
        });

        it('should throw error when no reset was requested', async () => {
            const password = await bcrypt.hash('oldPassword123', 1);
            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
            });

            await expect(AuthService.resetPassword(userEmail, '123456', 'newPassword123'))
                .rejects.toThrow('No reset request found. Please request a new code.');
        });
    });

    describe('refreshToken', () => {
        it('should refresh token successfully', async () => {
            const userId = new mongoose.Types.ObjectId();
            const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' as jwt.SignOptions['expiresIn'] });

            await User.create({
                _id: userId,
                userName,
                displayName: 'Test User',
                email: userEmail,
                password: 'securePassword123',
                refreshToken,
            } as any);

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

            await User.create({
                _id: userId,
                userName,
                displayName: 'Test User',
                email: userEmail,
                password: 'securePassword123',
                refreshToken: storedRefreshToken,
            } as any);

            await expect(AuthService.refreshToken(differentRefreshToken)).rejects.toThrow('Invalid refresh token');
        });
    });
});

