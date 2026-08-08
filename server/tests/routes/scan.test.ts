const mockGenerateContent = jest.fn();
const mockCheckMultiple = jest.fn().mockResolvedValue(new Map());

jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: { generateContent: mockGenerateContent }
    }))
}));

jest.mock('../../services/ai.service', () => {
    const actual = jest.requireActual('../../services/ai.service');
    return {
        ...actual,
        AIService: {
            ...actual.AIService,
            checkMultipleItemsIfRunningLow: (...args: any[]) => mockCheckMultiple(...args),
        },
    };
});

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
        mockCheckMultiple.mockResolvedValue(new Map());
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

    const mockAIScan = (items: { name: string; quantity: string }[], imageIssue: string | null = null) => {
        const itemsWithConfidence = items.map(item => ({ ...item, confidence: 'high' }));
        mockGenerateContent.mockResolvedValueOnce({
            text: JSON.stringify({ imageIssue, items: itemsWithConfidence })
        });
    };

    describe('POST /fridges/me/scans', () => {
        it('should upload image and return detected items', async () => {
            mockAIScan([
                { name: 'egg', quantity: '6' },
                { name: 'milk', quantity: '1 liter' }
            ]);

            const res = await request(app)
                .post('/fridges/me/scans')
                .set('Authorization', token)
                .attach('image', FIXTURE_IMAGE);

            expect(res.statusCode).toBe(201);
            expect(res.body.ok).toBe(true);
            expect(res.body.data.status).toBe('completed');
            expect(res.body.data.detectedItems).toHaveLength(2);
            expect(res.body.data.detectedItems[0].name).toBe('Egg');
            expect(res.body.data.detectedItems[1].name).toBe('Milk');
            expect(res.body.data.addedItemIds).toHaveLength(2);

            const items = await InventoryItem.find({ fridgeId });
            expect(items).toHaveLength(2);
            const names = items.map(i => i.name);
            expect(names).toContain('Egg');
            expect(names).toContain('Milk');
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

            mockAIScan([{ name: 'egg', quantity: '12' }]);

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
        });

        it('should create items with SHARED ownership', async () => {
            mockAIScan([{ name: 'cheese', quantity: '1 block' }]);

            const res = await request(app)
                .post('/fridges/me/scans')
                .set('Authorization', token)
                .attach('image', FIXTURE_IMAGE);

            expect(res.statusCode).toBe(201);

            const item = await InventoryItem.findOne({ fridgeId, name: 'Cheese' });
            expect(item).not.toBeNull();
            expect(item!.ownership).toBe('SHARED');
        });

        it('should create new items with no owner by default', async () => {
            mockAIScan([{ name: 'butter', quantity: '250g' }]);

            const res = await request(app)
                .post('/fridges/me/scans')
                .set('Authorization', token)
                .attach('image', FIXTURE_IMAGE);

            expect(res.statusCode).toBe(201);

            const item = await InventoryItem.findOne({ fridgeId, name: 'Butter' });
            expect(item).not.toBeNull();
            expect(item!.ownerId).toBeNull();
        });

        it('should preserve an existing item\'s owner when re-scanned', async () => {
            const otherOwnerId = new mongoose.Types.ObjectId();
            await InventoryItem.create({
                fridgeId,
                ownerId: otherOwnerId,
                name: 'cucumber',
                quantity: '2',
                ownership: 'SHARED',
                isRunningLow: false
            });

            mockAIScan([{ name: 'cucumber', quantity: '5' }]);

            const res = await request(app)
                .post('/fridges/me/scans')
                .set('Authorization', token)
                .attach('image', FIXTURE_IMAGE);

            expect(res.statusCode).toBe(201);

            const item = await InventoryItem.findOne({ fridgeId, name: 'cucumber' });
            expect(item).not.toBeNull();
            expect(item!.quantity).toBe('5');
            expect(item!.ownerId?.toString()).toBe(otherOwnerId.toString());
        });


        it('should NOT remove items not seen in the new scan, but SHOULD remove if quantity is 0', async () => {
            // Pre-existing items in the fridge
            await InventoryItem.create([
                { fridgeId, ownerId: userId, name: 'milk', quantity: '1 liter', ownership: 'SHARED', isRunningLow: false },
                { fridgeId, ownerId: userId, name: 'eggs', quantity: '6', ownership: 'SHARED', isRunningLow: false },
                { fridgeId, ownerId: userId, name: 'cheese', quantity: '1 block', ownership: 'PRIVATE', isRunningLow: false }
            ]);

            // New scan sees milk (updated quantity), bread (new item), and eggs (0).
            // Cheese is NOT detected, so it should be left unchanged.
            mockAIScan([
                { name: 'milk', quantity: '500ml' },
                { name: 'bread', quantity: '1 loaf' },
                { name: 'eggs', quantity: '0' }
            ]);

            const res = await request(app)
                .post('/fridges/me/scans')
                .set('Authorization', token)
                .attach('image', FIXTURE_IMAGE);

            expect(res.statusCode).toBe(201);
            expect(res.body.data.status).toBe('completed');

            const remaining = await InventoryItem.find({ fridgeId });
            const names = remaining.map(i => i.name).sort();
            expect(names).toEqual(['Bread', 'cheese', 'milk']);

            const milk = remaining.find(i => i.name === 'milk');
            expect(milk!.quantity).toBe('500ml');
        });

        describe('scan changes diff (added / updated / removed)', () => {
            it('should report newly added items under changes.added', async () => {
                mockAIScan([
                    { name: 'bread', quantity: '1 loaf' },
                    { name: 'milk', quantity: '1 liter' },
                ]);

                const res = await request(app)
                    .post('/fridges/me/scans')
                    .set('Authorization', token)
                    .attach('image', FIXTURE_IMAGE);

                expect(res.statusCode).toBe(201);
                expect(res.body.data.changes).toBeDefined();
                expect(res.body.data.changes.added).toEqual(
                    expect.arrayContaining([
                        { name: 'Bread', quantity: '1 loaf' },
                        { name: 'Milk', quantity: '1 liter' },
                    ])
                );
                expect(res.body.data.changes.added).toHaveLength(2);
                expect(res.body.data.changes.updated).toEqual([]);
                expect(res.body.data.changes.removed).toEqual([]);
            });

            it('should report quantity-changed items under changes.updated', async () => {
                await InventoryItem.create({
                    fridgeId, ownerId: userId, name: 'milk', quantity: '1 liter', ownership: 'SHARED', isRunningLow: false,
                });

                mockAIScan([{ name: 'milk', quantity: '500ml' }]);

                const res = await request(app)
                    .post('/fridges/me/scans')
                    .set('Authorization', token)
                    .attach('image', FIXTURE_IMAGE);

                expect(res.statusCode).toBe(201);
                expect(res.body.data.changes.updated).toEqual([
                    { name: 'milk', oldQuantity: '1 liter', newQuantity: '500ml' },
                ]);
                expect(res.body.data.changes.added).toEqual([]);
                expect(res.body.data.changes.removed).toEqual([]);
            });

            it('should NOT report an item as updated when its quantity is unchanged', async () => {
                await InventoryItem.create({
                    fridgeId, ownerId: userId, name: 'milk', quantity: '1 liter', ownership: 'SHARED', isRunningLow: false,
                });

                // Same item, same quantity detected again.
                mockAIScan([{ name: 'milk', quantity: '1 liter' }]);

                const res = await request(app)
                    .post('/fridges/me/scans')
                    .set('Authorization', token)
                    .attach('image', FIXTURE_IMAGE);

                expect(res.statusCode).toBe(201);
                expect(res.body.data.changes.updated).toEqual([]);
                expect(res.body.data.changes.added).toEqual([]);
                expect(res.body.data.changes.removed).toEqual([]);
            });

            it('should report items with quantity 0 under changes.removed', async () => {
                await InventoryItem.create([
                    { fridgeId, ownerId: userId, name: 'eggs', quantity: '6', ownership: 'SHARED', isRunningLow: false },
                    { fridgeId, ownerId: userId, name: 'cheese', quantity: '1 block', ownership: 'PRIVATE', isRunningLow: false },
                ]);

                // New scan explicitly reports eggs as '0' and 'cheese' as 'none'. Both should be removed.
                mockAIScan([
                    { name: 'milk', quantity: '1 liter' },
                    { name: 'eggs', quantity: '0' },
                    { name: 'cheese', quantity: 'none' }
                ]);

                const res = await request(app)
                    .post('/fridges/me/scans')
                    .set('Authorization', token)
                    .attach('image', FIXTURE_IMAGE);

                expect(res.statusCode).toBe(201);
                expect(res.body.data.changes.added).toEqual([
                    { name: 'Milk', quantity: '1 liter' },
                ]);
                expect(res.body.data.changes.removed).toEqual(
                    expect.arrayContaining([
                        { name: 'eggs', quantity: '6' },
                        { name: 'cheese', quantity: '1 block' },
                    ])
                );
                expect(res.body.data.changes.removed).toHaveLength(2);
                expect(res.body.data.changes.updated).toEqual([]);
            });

            it('should report a mixed scan correctly (added + updated + removed)', async () => {
                await InventoryItem.create([
                    { fridgeId, ownerId: userId, name: 'milk', quantity: '1 liter', ownership: 'SHARED', isRunningLow: false },
                    { fridgeId, ownerId: userId, name: 'eggs', quantity: '6', ownership: 'SHARED', isRunningLow: false },
                ]);

                // milk quantity changes, bread is new, eggs explicitly 0.
                mockAIScan([
                    { name: 'milk', quantity: '500ml' },
                    { name: 'bread', quantity: '1 loaf' },
                    { name: 'eggs', quantity: '0' },
                ]);

                const res = await request(app)
                    .post('/fridges/me/scans')
                    .set('Authorization', token)
                    .attach('image', FIXTURE_IMAGE);

                expect(res.statusCode).toBe(201);
                expect(res.body.data.changes.added).toEqual([
                    { name: 'Bread', quantity: '1 loaf' },
                ]);
                expect(res.body.data.changes.updated).toEqual([
                    { name: 'milk', oldQuantity: '1 liter', newQuantity: '500ml' },
                ]);
                expect(res.body.data.changes.removed).toEqual([
                    { name: 'eggs', quantity: '6' },
                ]);
            });

            it('should persist changes so another member can read them after the scan', async () => {
                await InventoryItem.create({
                    fridgeId, ownerId: userId, name: 'milk', quantity: '1 liter', ownership: 'SHARED', isRunningLow: false,
                });

                mockAIScan([
                    { name: 'milk', quantity: '500ml' },
                    { name: 'bread', quantity: '1 loaf' },
                ]);

                const uploadRes = await request(app)
                    .post('/fridges/me/scans')
                    .set('Authorization', token)
                    .attach('image', FIXTURE_IMAGE);

                expect(uploadRes.statusCode).toBe(201);

                const detailRes = await request(app)
                    .get(`/fridges/me/scans/${uploadRes.body.data.id}`)
                    .set('Authorization', token);

                expect(detailRes.statusCode).toBe(200);
                expect(detailRes.body.data.changes.added).toEqual([
                    { name: 'Bread', quantity: '1 loaf' },
                ]);
                expect(detailRes.body.data.changes.updated).toEqual([
                    { name: 'milk', oldQuantity: '1 liter', newQuantity: '500ml' },
                ]);
                expect(detailRes.body.data.changes.removed).toEqual([]);
            });

            it('should persist empty changes lists so a no-op scan is still reported as such', async () => {
                await InventoryItem.create({
                    fridgeId, ownerId: userId, name: 'milk', quantity: '1 liter', ownership: 'SHARED', isRunningLow: false,
                });

                mockAIScan([{ name: 'milk', quantity: '1 liter' }]);

                const uploadRes = await request(app)
                    .post('/fridges/me/scans')
                    .set('Authorization', token)
                    .attach('image', FIXTURE_IMAGE);

                expect(uploadRes.statusCode).toBe(201);

                const detailRes = await request(app)
                    .get(`/fridges/me/scans/${uploadRes.body.data.id}`)
                    .set('Authorization', token);

                expect(detailRes.statusCode).toBe(200);
                expect(detailRes.body.data.changes).toEqual({ added: [], updated: [], removed: [] });
            });

            it('should return empty changes lists on an empty-scan safety-guard path', async () => {
                await InventoryItem.create({
                    fridgeId, ownerId: userId, name: 'milk', quantity: '1 liter', ownership: 'SHARED', isRunningLow: false,
                });

                mockAIScan([]);

                const res = await request(app)
                    .post('/fridges/me/scans')
                    .set('Authorization', token)
                    .attach('image', FIXTURE_IMAGE);

                expect(res.statusCode).toBe(201);
                expect(res.body.data.changes.added).toEqual([]);
                expect(res.body.data.changes.updated).toEqual([]);
                expect(res.body.data.changes.removed).toEqual([]);
            });
        });

        it('should NOT wipe the fridge when the scan returns zero items (safety guard)', async () => {
            // Pre-existing items in the fridge
            await InventoryItem.create([
                { fridgeId, ownerId: userId, name: 'milk', quantity: '1 liter', ownership: 'SHARED', isRunningLow: false },
                { fridgeId, ownerId: userId, name: 'eggs', quantity: '6', ownership: 'SHARED', isRunningLow: false }
            ]);

            // AI returns a valid but empty response (e.g. fridge looks empty OR AI glitch).
            mockAIScan([]);

            const res = await request(app)
                .post('/fridges/me/scans')
                .set('Authorization', token)
                .attach('image', FIXTURE_IMAGE);

            expect(res.statusCode).toBe(201);
            expect(res.body.data.status).toBe('completed');
            expect(res.body.data.detectedItems).toHaveLength(0);
            expect(res.body.data.addedItemIds).toHaveLength(0);

            // Existing items must still be there.
            const remaining = await InventoryItem.find({ fridgeId });
            expect(remaining).toHaveLength(2);
        });

        it('should return failed scan with BAD_SCAN_IMAGE error when AI flags the photo as unusable', async () => {
            await InventoryItem.create({
                fridgeId, ownerId: userId, name: 'milk', quantity: '1 liter', ownership: 'SHARED', isRunningLow: false
            });

            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ imageIssue: 'too_blurry', items: [] })
            });

            const res = await request(app)
                .post('/fridges/me/scans')
                .set('Authorization', token)
                .attach('image', FIXTURE_IMAGE);

            expect(res.statusCode).toBe(201);
            expect(res.body.data.status).toBe('failed');
            expect(res.body.data.error).toMatch(/blurry/i);

            // A bad-image scan must not touch inventory.
            const remaining = await InventoryItem.find({ fridgeId });
            expect(remaining).toHaveLength(1);
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
            mockAIScan([]);

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

    describe('GET /fridges/me/scans', () => {
        const seedScan = async (targetFridgeId: string, name: string, createdAt: Date) => {
            const scan = await ScanModel.create({
                fridgeId: new mongoose.Types.ObjectId(targetFridgeId),
                userId: new mongoose.Types.ObjectId(userId),
                status: 'completed',
                detectedItems: [{ name, quantity: '1' }],
                addedItemIds: [],
                changes: { added: [{ name, quantity: '1' }], updated: [], removed: [] }
            });
            // timestamps would otherwise stamp every seeded scan with "now"
            await ScanModel.findByIdAndUpdate(scan._id, { createdAt }, { timestamps: false });
            return scan._id.toString();
        };

        it('should return the fridge scan history newest first, including changes', async () => {
            const olderId = await seedScan(fridgeId, 'egg', new Date('2024-01-01T10:00:00.000Z'));
            const newerId = await seedScan(fridgeId, 'bread', new Date('2024-02-01T10:00:00.000Z'));

            const res = await request(app)
                .get('/fridges/me/scans')
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.total).toBe(2);
            expect(res.body.items.map((s: any) => s.id)).toEqual([newerId, olderId]);
            expect(res.body.items[0].changes.added).toEqual([{ name: 'bread', quantity: '1' }]);
        });

        it('should only return scans of the active fridge', async () => {
            const otherFridge = await FridgeModel.create({
                name: 'Other Fridge',
                inviteCode: `OTHER_${Date.now()}`,
                members: [{ userId: new mongoose.Types.ObjectId(), joinedAt: new Date() }]
            });
            await seedScan(otherFridge._id.toString(), 'cheese', new Date('2024-03-01T10:00:00.000Z'));
            const mineId = await seedScan(fridgeId, 'egg', new Date('2024-01-01T10:00:00.000Z'));

            const res = await request(app)
                .get('/fridges/me/scans')
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.total).toBe(1);
            expect(res.body.items[0].id).toBe(mineId);
        });

        it('should respect the limit query param', async () => {
            await seedScan(fridgeId, 'egg', new Date('2024-01-01T10:00:00.000Z'));
            const newerId = await seedScan(fridgeId, 'bread', new Date('2024-02-01T10:00:00.000Z'));

            const res = await request(app)
                .get('/fridges/me/scans?limit=1')
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.total).toBe(2);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].id).toBe(newerId);
        });

        it('should return 400 when user has no active fridge', async () => {
            await User.findByIdAndUpdate(userId, { activeFridgeId: null });

            const res = await request(app)
                .get('/fridges/me/scans')
                .set('Authorization', token);

            expect(res.statusCode).toBe(400);
        });

        it('should return 401 without authorization', async () => {
            const res = await request(app).get('/fridges/me/scans');

            expect(res.statusCode).toBe(401);
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
