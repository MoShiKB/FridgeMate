import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../../index';
import { token, userId } from '../setup';
import { FridgeModel } from '../../models/fridge.model';
import InventoryItem from '../../models/inventory-item.model';
import { ScanModel } from '../../models/scan.model';
import User from '../../models/user.model';
import mongoose from 'mongoose';

// Mock the AI Service
const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => {
    return {
        GoogleGenAI: jest.fn().mockImplementation(() => ({
            models: {
                generateContent: mockGenerateContent
            }
        }))
    };
});

// Create a tiny 1x1 JPEG buffer for test uploads
const TINY_JPEG = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsK' +
    'CwsKDBAQDQ4RDAsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQU' +
    'FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIA' +
    'AhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEA' +
    'AAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AqwA//9k=',
    'base64'
);

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures');
const FIXTURE_IMAGE = path.join(FIXTURE_DIR, 'test-image.jpg');

fs.mkdirSync(FIXTURE_DIR, { recursive: true });
fs.writeFileSync(FIXTURE_IMAGE, TINY_JPEG);

describe('Scan Routes', () => {
    let fridgeId: string;

    beforeEach(async () => {
        jest.clearAllMocks();
        await FridgeModel.deleteMany({});
        await InventoryItem.deleteMany({});
        await ScanModel.deleteMany({});

        const fridge = await FridgeModel.create({
            name: 'Test Fridge',
            inviteCode: `SCAN_${Date.now()}`,
            members: [{ userId: new mongoose.Types.ObjectId(userId), joinedAt: new Date() }]
        });
        fridgeId = fridge._id.toString();

        await User.findByIdAndUpdate(userId, { activeFridgeId: fridge._id });
    });

    describe('POST /fridges/me/scans', () => {
        it('should upload image and return detected items', async () => {
            mockGenerateContent
                .mockResolvedValueOnce({
                    text: JSON.stringify([
                        { name: 'egg', quantity: '6' },
                        { name: 'milk', quantity: '1 liter' }
                    ])
                })
                .mockResolvedValueOnce({
                    text: JSON.stringify({ isRunningLow: false, reasoning: 'Sufficient.' })
                })
                .mockResolvedValueOnce({
                    text: JSON.stringify({ isRunningLow: false, reasoning: 'Sufficient.' })
                });

            const res = await request(app)
                .post('/fridges/me/scans')
                .set('Authorization', token)
                .attach('image', FIXTURE_IMAGE);

            expect(res.statusCode).toBe(201);
            expect(res.body.ok).toBe(true);
            expect(res.body.data.status).toBe('completed');
            expect(res.body.data.detectedItems).toHaveLength(2);
            expect(res.body.data.detectedItems[0].name).toBe('egg');
            expect(res.body.data.detectedItems[1].name).toBe('milk');
            expect(res.body.data.addedItemIds).toHaveLength(2);

            const items = await InventoryItem.find({ fridgeId });
            expect(items).toHaveLength(2);
            const names = items.map(i => i.name);
            expect(names).toContain('egg');
            expect(names).toContain('milk');
        });

        it('should update existing items instead of duplicating', async () => {
            await InventoryItem.create({
                fridgeId,
                ownerId: userId,
                name: 'egg',
                quantity: '2',
                ownership: 'SHARED',
                isRunningLow: true
            });

            mockGenerateContent
                .mockResolvedValueOnce({
                    text: JSON.stringify([
                        { name: 'egg', quantity: '12' }
                    ])
                })
                .mockResolvedValueOnce({
                    text: JSON.stringify({ isRunningLow: false, reasoning: 'Plenty.' })
                });

            const res = await request(app)
                .post('/fridges/me/scans')
                .set('Authorization', token)
                .attach('image', FIXTURE_IMAGE);

            expect(res.statusCode).toBe(201);
            expect(res.body.data.status).toBe('completed');
            expect(res.body.data.detectedItems).toHaveLength(1);

            const items = await InventoryItem.find({ fridgeId, name: /^egg$/i });
            expect(items).toHaveLength(1);
            expect(items[0].quantity).toBe('12');
            expect(items[0].isRunningLow).toBe(false);
        });

        it('should create items with SHARED ownership', async () => {
            mockGenerateContent
                .mockResolvedValueOnce({
                    text: JSON.stringify([
                        { name: 'cheese', quantity: '1 block' }
                    ])
                })
                .mockResolvedValueOnce({
                    text: JSON.stringify({ isRunningLow: false, reasoning: 'Sufficient.' })
                });

            const res = await request(app)
                .post('/fridges/me/scans')
                .set('Authorization', token)
                .attach('image', FIXTURE_IMAGE);

            expect(res.statusCode).toBe(201);

            const item = await InventoryItem.findOne({ fridgeId, name: 'cheese' });
            expect(item).not.toBeNull();
            expect(item!.ownership).toBe('SHARED');
        });

        it('should return failed scan when AI detection fails', async () => {
            mockGenerateContent.mockRejectedValueOnce(new Error('AI service unavailable'));

            const res = await request(app)
                .post('/fridges/me/scans')
                .set('Authorization', token)
                .attach('image', FIXTURE_IMAGE);

            expect(res.statusCode).toBe(201);
            expect(res.body.data.status).toBe('failed');
            expect(res.body.data.error).toBeDefined();
            expect(res.body.data.detectedItems).toHaveLength(0);
        });

        it('should return 400 when no image file is provided', async () => {
            const res = await request(app)
                .post('/fridges/me/scans')
                .set('Authorization', token);

            expect(res.statusCode).toBe(400);
        });

        it('should return 400 when user has no active fridge', async () => {
            await User.findByIdAndUpdate(userId, { activeFridgeId: null });

            const res = await request(app)
                .post('/fridges/me/scans')
                .set('Authorization', token)
                .attach('image', FIXTURE_IMAGE);

            expect(res.statusCode).toBe(400);
        });

        it('should return 401 without authorization', async () => {
            const res = await request(app)
                .post('/fridges/me/scans');

            expect(res.statusCode).toBe(401);
        });

        it('should handle empty AI detection result', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify([])
            });

            const res = await request(app)
                .post('/fridges/me/scans')
                .set('Authorization', token)
                .attach('image', FIXTURE_IMAGE);

            expect(res.statusCode).toBe(201);
            expect(res.body.data.status).toBe('completed');
            expect(res.body.data.detectedItems).toHaveLength(0);
            expect(res.body.data.addedItemIds).toHaveLength(0);
        });
    });

    describe('GET /fridges/me/scans/:scanId', () => {
        let scanId: string;

        beforeEach(async () => {
            const scan = await ScanModel.create({
                fridgeId: new mongoose.Types.ObjectId(fridgeId),
                userId: new mongoose.Types.ObjectId(userId),
                status: 'completed',
                detectedItems: [
                    { name: 'egg', quantity: '6' },
                    { name: 'milk', quantity: '1 liter' }
                ],
                addedItemIds: []
            });
            scanId = scan._id.toString();
        });

        it('should return a scan by ID', async () => {
            const res = await request(app)
                .get(`/fridges/me/scans/${scanId}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.data.id).toBe(scanId);
            expect(res.body.data.status).toBe('completed');
            expect(res.body.data.detectedItems).toHaveLength(2);
        });

        it('should return 404 for non-existent scan', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .get(`/fridges/me/scans/${fakeId}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(404);
        });

        it('should return 403 if user is not a member of the scan fridge', async () => {
            const otherFridge = await FridgeModel.create({
                name: 'Other Fridge',
                inviteCode: `OTHER_${Date.now()}`,
                members: [{ userId: new mongoose.Types.ObjectId(), joinedAt: new Date() }]
            });

            const otherScan = await ScanModel.create({
                fridgeId: otherFridge._id,
                userId: new mongoose.Types.ObjectId(),
                status: 'completed',
                detectedItems: [],
                addedItemIds: []
            });

            const res = await request(app)
                .get(`/fridges/me/scans/${otherScan._id}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(403);
        });

        it('should return 401 without authorization', async () => {
            const res = await request(app)
                .get(`/fridges/me/scans/${scanId}`);

            expect(res.statusCode).toBe(401);
        });
    });
});
