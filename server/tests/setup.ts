import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/user.model';
import bcrypt from "bcrypt";

dotenv.config();

process.env.BCRYPT_ROUNDS = '1';

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

let testCounter = 0;

beforeAll(async () => {
    const uri = process.env.MONGO_TEST_URI;
    if (!uri) throw new Error('MONGO_TEST_URI not set — globalSetup may not have run');
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(uri);
    }
});

beforeEach(async () => {
    testCounter++;
    const existingUser = await User.findById(userId);
    if (!existingUser) {
        const password = await bcrypt.hash('securePassword123', 1);

        await User.create({
            _id: userId,
            userName: 'testuser',
            displayName: 'Test User',
            email: `testuser-setup-${testCounter}@example.com`,
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
});

export default testSetup;
