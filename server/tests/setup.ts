import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../models/user.model';
import bcrypt from "bcrypt";

dotenv.config();

if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET || !process.env.JWT_EXPIRES_IN || !process.env.JWT_REFRESH_EXPIRES_IN) {
    throw new Error('JWT environment variables are not properly configured in the .env file');
}

export const userId = new mongoose.Types.ObjectId();
export const token = `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET as string, { expiresIn: process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] })}`;
export const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] });

const testSetup = {
    token,
    refreshToken,
    userId,
};

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

beforeEach(async () => {
    const existingUser = await User.findById(userId);
    if (!existingUser) {
        const password = await bcrypt.hash('securePassword123', 10);

        await User.create({
            _id: userId,
            userName: 'testuser',
            displayName: 'Test User',
            email: `testuser${Date.now()}@example.com`,
            password,
            refreshToken,
        });
    }
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key]?.deleteMany({});
    }
});

afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
});

export default testSetup;
