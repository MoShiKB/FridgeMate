import request from 'supertest';
import app from '../../index';
import { token, userId } from '../setup';
import { FridgeModel as Fridge } from '../../models/fridge.model';
import InventoryItem from '../../models/inventory-item.model';
import mongoose from 'mongoose';

const testUserId = userId;

describe('Inventory Item Routes', () => {
    let fridgeId: string;

    beforeEach(async () => {
        // Clear collections before each test to ensure clean state
        await Fridge.deleteMany({});
        await InventoryItem.deleteMany({});

        // Create a fridge for the test user
        const fridge = await Fridge.create({
            name: 'Test Fridge',
            inviteCode: 'TEST12',
            members: [{ userId: testUserId, joinedAt: new Date() }]
        });
        fridgeId = fridge._id.toString();
    });

    describe('POST /fridges/:fridgeId/items', () => {
        const newItem = {
            name: 'Milk',
            quantity: '1 liter',
            ownership: 'PRIVATE'
        };

        it('should create a new inventory item', async () => {
            const res = await request(app)
                .post(`/fridges/${fridgeId}/items`)
                .set('Authorization', token)
                .send(newItem);

            expect(res.statusCode).toBe(201);
            expect(res.body.data).toHaveProperty('_id');
            expect(res.body.data.name).toBe(newItem.name);
            expect(res.body.data.quantity).toBe(newItem.quantity);
            expect(res.body.data.fridgeId).toBe(fridgeId);
            expect(res.body.data.ownerId).toBe(testUserId.toString());
        });

        it('should perform validation on input', async () => {
            const res = await request(app)
                .post(`/fridges/${fridgeId}/items`)
                .set('Authorization', token)
                .send({
                    name: '', // Invalid empty name
                    quantity: '1 liter'
                });

            expect(res.statusCode).toBe(400);
        });
    });

    describe('GET /fridges/:fridgeId/items', () => {
        beforeEach(async () => {
            await InventoryItem.create([
                {
                    fridgeId,
                    ownerId: testUserId,
                    name: 'Apple',
                    quantity: '5 pcs',
                    ownership: 'SHARED'
                },
                {
                    fridgeId,
                    ownerId: testUserId,
                    name: 'Banana',
                    quantity: '1 bunch',
                    ownership: 'PRIVATE'
                }
            ]);
        });

        it('should return all items for the fridge', async () => {
            const res = await request(app)
                .get(`/fridges/${fridgeId}/items`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(2);
            // Check that items are returned
            const names = res.body.items.map((item: any) => item.name);
            expect(names).toContain('Apple');
            expect(names).toContain('Banana');
        });

        it('should filter items by ownership', async () => {
            const res = await request(app)
                .get(`/fridges/${fridgeId}/items?ownership=SHARED`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].name).toBe('Apple');
        });
    });

    describe('GET /fridges/:fridgeId/items/:itemId', () => {
        let itemId: string;

        beforeEach(async () => {
            const item = await InventoryItem.create({
                fridgeId,
                ownerId: testUserId,
                name: 'Carrot',
                quantity: '1 bag',
                ownership: 'SHARED'
            });
            itemId = item._id.toString();
        });

        it('should return a single item by ID', async () => {
            const res = await request(app)
                .get(`/fridges/${fridgeId}/items/${itemId}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.name).toBe('Carrot');
        });

        it('should return 404 for non-existent item', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .get(`/fridges/${fridgeId}/items/${fakeId}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(404);
        });
    });

    describe('PATCH /fridges/:fridgeId/items/:itemId', () => {
        let itemId: string;

        beforeEach(async () => {
            const item = await InventoryItem.create({
                fridgeId,
                ownerId: testUserId,
                name: 'Old Name',
                quantity: '1 unit',
                ownership: 'PRIVATE'
            });
            itemId = item._id.toString();
        });

        it('should update an item successfully', async () => {
            const updates = {
                name: 'New Name',
                quantity: '2 units'
            };

            const res = await request(app)
                .patch(`/fridges/${fridgeId}/items/${itemId}`)
                .set('Authorization', token)
                .send(updates);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.name).toBe(updates.name);
            expect(res.body.data.quantity).toBe(updates.quantity);
        });
    });

    describe('PATCH - forbidden for non-owner', () => {
        it('should return 403 when another user tries to update', async () => {
            const otherUser = new mongoose.Types.ObjectId();
            const item = await InventoryItem.create({
                fridgeId,
                ownerId: otherUser,
                name: 'Other Item',
                quantity: '1 unit',
                ownership: 'SHARED',
            });

            const res = await request(app)
                .patch(`/fridges/${fridgeId}/items/${item._id}`)
                .set('Authorization', token)
                .send({ name: 'Stolen' });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET - private item visibility', () => {
        it('should return 403 for another user\'s private item', async () => {
            const otherUser = new mongoose.Types.ObjectId();
            const item = await InventoryItem.create({
                fridgeId,
                ownerId: otherUser,
                name: 'Secret Snack',
                quantity: '1',
                ownership: 'PRIVATE',
            });

            const res = await request(app)
                .get(`/fridges/${fridgeId}/items/${item._id}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(403);
        });
    });

    describe('Fridge membership check', () => {
        it('should return 403 when user is not a fridge member', async () => {
            const otherFridge = await Fridge.create({
                name: 'Not My Fridge',
                inviteCode: 'NOPE99',
                members: [{ userId: new mongoose.Types.ObjectId(), joinedAt: new Date() }],
            });

            const res = await request(app)
                .get(`/fridges/${otherFridge._id}/items`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(403);
        });

        it('should return 404 for non-existent fridge', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .get(`/fridges/${fakeId}/items`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(404);
        });
    });

    describe('DELETE /fridges/:fridgeId/items/:itemId', () => {
        let itemId: string;

        beforeEach(async () => {
            const item = await InventoryItem.create({
                fridgeId,
                ownerId: testUserId,
                name: 'To Delete',
                quantity: '1 unit',
                ownership: 'PRIVATE'
            });
            itemId = item._id.toString();
        });

        it('should delete an item successfully', async () => {
            const res = await request(app)
                .delete(`/fridges/${fridgeId}/items/${itemId}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);

            const item = await InventoryItem.findById(itemId);
            expect(item).toBeNull();
        });

        it('should return 404 when deleting non-existent item', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/fridges/${fridgeId}/items/${fakeId}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(404);
        });

        it('should return 403 when non-owner tries to delete', async () => {
            const otherUser = new mongoose.Types.ObjectId();
            const item = await InventoryItem.create({
                fridgeId,
                ownerId: otherUser,
                name: 'Not Mine',
                quantity: '1',
                ownership: 'SHARED',
            });

            const res = await request(app)
                .delete(`/fridges/${fridgeId}/items/${item._id}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET with PRIVATE ownership filter', () => {
        it('should return only own private items when filtering', async () => {
            const otherUser = new mongoose.Types.ObjectId();

            await InventoryItem.create([
                { fridgeId, ownerId: testUserId, name: 'My Yogurt', quantity: '1', ownership: 'PRIVATE' },
                { fridgeId, ownerId: otherUser, name: 'Their Yogurt', quantity: '1', ownership: 'PRIVATE' },
                { fridgeId, ownerId: testUserId, name: 'Shared Milk', quantity: '1', ownership: 'SHARED' },
            ]);

            const res = await request(app)
                .get(`/fridges/${fridgeId}/items?ownership=PRIVATE`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].name).toBe('My Yogurt');
        });
    });

    describe('Auth required', () => {
        it('should return 401 without token', async () => {
            const res = await request(app)
                .get(`/fridges/${fridgeId}/items`);

            expect(res.statusCode).toBe(401);
        });
    });
});
