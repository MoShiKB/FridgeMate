import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../index';
import User, { IUser } from '../../models/user.model';
import { token, refreshToken, userId as setupUserId } from '../setup';
import mongoose from "mongoose";

describe('Authentication Controller Tests', () => {
    let userId: string;
    let userName: string;
    let userEmail: string;

    beforeEach(() => {
        const mongoUserId = new mongoose.Types.ObjectId();
        userId = mongoUserId.toString();
        userName = `testuser-${Date.now()}`;
        userEmail = `testuser${Date.now()}@example.com`;
        jest.clearAllMocks();
    });

    describe('POST /auth/register', () => {
        it('should register a new user successfully', async () => {
            const res = await request(app)
                .post('/auth/register')
                .send({
                    userName,
                    email: userEmail,
                    password: 'securePassword123',
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.message).toBe('User registered successfully');
            expect(res.body.user).toHaveProperty('_id');
        });

        it('should return 409 if email already exists during registration', async () => {
            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password: 'securePassword123',
            });

            const res = await request(app)
                .post('/auth/register')
                .send({
                    userName: 'anotheruser',
                    email: userEmail,
                    password: 'securePassword123',
                });

            expect(res.statusCode).toBe(409);
            expect(res.body.message).toBe('User already exists');
        });

        it('should return 500 if an error occurs during registration', async () => {
            jest.spyOn(User, 'create').mockImplementationOnce(() => {
                throw new Error('Database error');
            });

            const res = await request(app)
                .post('/auth/register')
                .send({
                    userName: 'john_doe',
                    email: 'john.doe@example.com',
                    password: 'securePassword123',
                });

            expect(res.statusCode).toBe(500);
            expect(res.body.message).toBe('Database error');

            jest.restoreAllMocks();
        });
    });

    describe('POST /auth/login', () => {
        it('should log in an existing user successfully', async () => {
            const password = await bcrypt.hash('securePassword123', 10);
            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
            });

            const res = await request(app)
                .post('/auth/login')
                .send({
                    email: userEmail,
                    password: 'securePassword123',
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Login successful');
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
        });

        it('should return 401 for invalid credentials during login', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send({
                    email: 'invalid@example.com',
                    password: 'wrongPassword',
                });

            expect(res.statusCode).toBe(401);
            expect(res.body.message).toBe('Invalid credentials');
        });

        it('should return 401 for wrong password', async () => {
            const password = await bcrypt.hash('securePassword123', 10);
            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
            });

            const res = await request(app)
                .post('/auth/login')
                .send({
                    email: userEmail,
                    password: 'wrongPassword',
                });

            expect(res.statusCode).toBe(401);
            expect(res.body.message).toBe('Invalid credentials');
        });

        it('should return 500 if an error occurs during login', async () => {
            jest.spyOn(User, 'findOne').mockImplementationOnce(() => {
                throw new Error('Database error');
            });

            const res = await request(app)
                .post('/auth/login')
                .send({
                    email: 'john.doe@example.com',
                    password: 'securePassword123',
                });

            expect(res.statusCode).toBe(500);
            expect(res.body.message).toBe('Database error');

            jest.restoreAllMocks();
        });
    });

    describe('POST /auth/logout', () => {
        it('should log out a user and invalidate the refresh token', async () => {
            await User.findByIdAndUpdate(setupUserId, { refreshToken });

            const res = await request(app)
                .post('/auth/logout')
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Logged out successfully');

            const updatedUser = await User.findById(setupUserId).select('+refreshToken');
            expect(updatedUser?.refreshToken).toBeNull();
        });

        it('should return 401 if no authorization header', async () => {
            const res = await request(app)
                .post('/auth/logout')
                .send({ refreshToken });

            expect(res.statusCode).toBe(401);
            expect(res.body.message).toBe('Unauthorized');
        });
    });

    describe('POST /auth/refresh-token', () => {
        it('should refresh the access token successfully', async () => {
            await User.findByIdAndUpdate(setupUserId, { refreshToken });

            const res = await request(app)
                .post('/auth/refresh-token')
                .send({ refreshToken });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('accessToken');
        });

        it('should return 500 for an invalid refresh token during refresh', async () => {
            const res = await request(app)
                .post('/auth/refresh-token')
                .send({ refreshToken: 'invalidToken' });

            expect(res.statusCode).toBe(500);
            expect(res.body.message).toBe('jwt malformed');
        });

        it('should return 400 for a missing refresh token during refresh', async () => {
            const res = await request(app).post('/auth/refresh-token');

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Refresh token is required');
        });
    });

    describe('POST /auth/forgot-password', () => {
        it('should send a reset code for a valid email', async () => {
            const password = await bcrypt.hash('securePassword123', 10);
            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
            });

            const res = await request(app)
                .post('/auth/forgot-password')
                .send({ email: userEmail });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Reset code sent to your email');

            const updatedUser = await User.findOne({ email: userEmail })
                .select('+resetPasswordToken +resetPasswordExpires');
            expect(updatedUser?.resetPasswordToken).toBeTruthy();
            expect(updatedUser?.resetPasswordExpires).toBeTruthy();
        });

        it('should return 404 for a non-existent email', async () => {
            const res = await request(app)
                .post('/auth/forgot-password')
                .send({ email: 'nonexistent@example.com' });

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('No account found with this email');
        });
    });

    describe('POST /auth/reset-password', () => {
        it('should reset password with a valid code', async () => {
            const password = await bcrypt.hash('oldPassword123', 10);
            const code = '123456';
            const hashedCode = await bcrypt.hash(code, 10);

            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
                resetPasswordToken: hashedCode,
                resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
            } as any);

            const res = await request(app)
                .post('/auth/reset-password')
                .send({ email: userEmail, code, newPassword: 'newPassword123' });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Password reset successfully');

            const loginRes = await request(app)
                .post('/auth/login')
                .send({ email: userEmail, password: 'newPassword123' });
            expect(loginRes.statusCode).toBe(200);
        });

        it('should return 400 for an invalid code', async () => {
            const password = await bcrypt.hash('oldPassword123', 10);
            const hashedCode = await bcrypt.hash('123456', 10);

            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
                resetPasswordToken: hashedCode,
                resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
            } as any);

            const res = await request(app)
                .post('/auth/reset-password')
                .send({ email: userEmail, code: '000000', newPassword: 'newPassword123' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Invalid reset code');
        });

        it('should return 400 for an expired code', async () => {
            const password = await bcrypt.hash('oldPassword123', 10);
            const hashedCode = await bcrypt.hash('123456', 10);

            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
                resetPasswordToken: hashedCode,
                resetPasswordExpires: new Date(Date.now() - 1000),
            } as any);

            const res = await request(app)
                .post('/auth/reset-password')
                .send({ email: userEmail, code: '123456', newPassword: 'newPassword123' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Reset code has expired. Please request a new one.');
        });

        it('should return 400 when no reset was requested', async () => {
            const password = await bcrypt.hash('oldPassword123', 10);
            await User.create<Partial<IUser>>({
                userName,
                displayName: 'Test User',
                email: userEmail,
                password,
            });

            const res = await request(app)
                .post('/auth/reset-password')
                .send({ email: userEmail, code: '123456', newPassword: 'newPassword123' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('No reset request found. Please request a new code.');
        });
    });

    describe('GET /health', () => {
        it('should return health status', async () => {
            const res = await request(app).get('/health');

            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(res.body).toHaveProperty('timestamp');
        });
    });
});

