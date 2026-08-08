import request from 'supertest';
import { token, userId } from '../setup';
import { FridgeModel } from '../../models/fridge.model';
import InventoryItem from '../../models/inventory-item.model';
import { ConsumptionProfileModel } from '../../models/consumption-profile.model';
import mongoose from 'mongoose';

// 1. Mock the AI Service
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

// 2. Import app
let app: any;

/**
 * The AI only supplies per-item facts now; whether something is running low is
 * decided by arithmetic against the household size. These scenarios pin down
 * that arithmetic end-to-end through the HTTP layer.
 */
describe('Inventory AI Scenarios', () => {

    beforeAll(() => {
        app = require('../../index').default;
    });

    const setupFridge = async (memberCount: number) => {
        const members = Array(memberCount).fill(null).map(() => ({
            userId: new mongoose.Types.ObjectId(),
            joinedAt: new Date()
        }));
        // Ensure one member is the current user (for auth)
        members[0].userId = new mongoose.Types.ObjectId(userId);

        const fridge = await FridgeModel.create({
            name: 'AI Scenario Fridge',
            inviteCode: `SCENARIO_${Date.now()}_${Math.random()}`,
            members: members
        });
        return fridge._id.toString();
    };

    const mockProfile = (name: string, overrides: Record<string, number> = {}) => {
        mockGenerateContent.mockResolvedValueOnce({
            text: JSON.stringify([{
                name,
                pieceServings: 1,
                packageServings: 8,
                gramsPerServing: 100,
                mlPerServing: 250,
                servingsPerPersonPerWeek: 4,
                ...overrides,
            }]),
        });
    };

    const addItem = (fridgeId: string, body: Record<string, string>) =>
        request(app)
            .post(`/fridges/${fridgeId}/items`)
            .set('Authorization', token)
            .send(body);

    beforeEach(async () => {
        jest.clearAllMocks();
        await FridgeModel.deleteMany({});
        await InventoryItem.deleteMany({});
        await ConsumptionProfileModel.deleteMany({});
    });

    describe('Scenario A: Discrete Item - Low Stock', () => {
        it('flags 3 eggs as low for a household of 4', async () => {
            const fId = await setupFridge(4);
            mockProfile('Eggs', { pieceServings: 1, packageServings: 12, servingsPerPersonPerWeek: 3 });

            const res = await addItem(fId, { name: 'Eggs', quantity: '3 pcs', ownership: 'SHARED' });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.isRunningLow).toBe(true);
            expect(res.body.data.suggestedRestockQuantity).toBeTruthy();
            expect(res.body.data.lowStockReason).toContain('4 people');
        });
    });

    describe('Scenario B: Discrete Item - Well Stocked', () => {
        it('leaves 12 eggs alone for a household of 2', async () => {
            const fId = await setupFridge(2);
            mockProfile('Eggs', { pieceServings: 1, packageServings: 12, servingsPerPersonPerWeek: 3 });

            const res = await addItem(fId, { name: 'Eggs', quantity: '12 pcs', ownership: 'SHARED' });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.isRunningLow).toBe(false);
            expect(res.body.data.suggestedRestockQuantity).toBeNull();
        });
    });

    describe('Scenario C: Condiments - Well Stocked', () => {
        it('does not flag a full ketchup bottle for a household of 5', async () => {
            const fId = await setupFridge(5);
            mockProfile('Ketchup', { packageServings: 30, servingsPerPersonPerWeek: 0.5 });

            const res = await addItem(fId, { name: 'Ketchup', quantity: '1 bottle', ownership: 'SHARED' });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.isRunningLow).toBe(false);
        });
    });

    describe('Scenario D: Condiments - Low Stock', () => {
        it('flags a ketchup bottle with a splash left for a household of 4', async () => {
            const fId = await setupFridge(4);
            mockProfile('Ketchup', {
                packageServings: 30, mlPerServing: 15, servingsPerPersonPerWeek: 0.5,
            });

            const res = await addItem(fId, { name: 'Ketchup', quantity: '5ml', ownership: 'SHARED' });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.isRunningLow).toBe(true);
            expect(res.body.data.suggestedRestockQuantity).toBeTruthy();
        });
    });

    describe('Scenario E: Private Item - Well Stocked', () => {
        it('measures a private item against one person regardless of fridge size', async () => {
            const fId = await setupFridge(4);
            mockProfile('Protein Yogurt', {
                pieceServings: 1, packageServings: 1, servingsPerPersonPerWeek: 1,
            });

            const priv = await addItem(fId, {
                name: 'Protein Yogurt', quantity: '1 pcs', ownership: 'PRIVATE',
            });
            const shared = await addItem(fId, {
                name: 'Protein Yogurt', quantity: '1 pcs', ownership: 'SHARED',
            });

            // Same item, same quantity, same fridge — only the audience differs.
            expect(priv.body.data.isRunningLow).toBe(false);
            expect(priv.body.data.lowStockReason).toBeNull();
            expect(shared.body.data.isRunningLow).toBe(true);
            expect(shared.body.data.lowStockReason).toContain('4 people');
        });
    });

    describe('Scenario F: Household size drives the outcome', () => {
        it('reaches opposite verdicts for the same quantity in a 1- and 8-person fridge', async () => {
            const smallFridge = await setupFridge(1);
            mockProfile('Milk', { packageServings: 8, servingsPerPersonPerWeek: 4 });
            const small = await addItem(smallFridge, {
                name: 'Milk', quantity: '1 carton', ownership: 'SHARED',
            });

            const bigFridge = await setupFridge(8);
            const big = await addItem(bigFridge, {
                name: 'Milk', quantity: '1 carton', ownership: 'SHARED',
            });

            expect(small.body.data.isRunningLow).toBe(false);
            expect(big.body.data.isRunningLow).toBe(true);
            // The second request reused the cached profile instead of asking again.
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });
    });

    describe('Scenario G: AI unavailable', () => {
        it('reports "not low" rather than guessing when the profile lookup fails', async () => {
            const fId = await setupFridge(4);
            mockGenerateContent.mockRejectedValueOnce(new Error('AI down'));

            const res = await addItem(fId, { name: 'Milk', quantity: '1 carton', ownership: 'SHARED' });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.isRunningLow).toBe(false);
            expect(res.body.data.daysOfSupply).toBeNull();
        });
    });
});
