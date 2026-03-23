import request from 'supertest';
import { token, userId } from '../setup';
import { FridgeModel } from '../../models/fridge.model';
import InventoryItem from '../../models/inventory-item.model';
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

describe('Inventory AI Scenarios', () => {

    beforeAll(() => {
        app = require('../../index').default;
    });

    // Helper to setup fridge with specific member count
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

    beforeEach(async () => {
        jest.clearAllMocks();
        await FridgeModel.deleteMany({});
        await InventoryItem.deleteMany({});
    });

    describe('Scenario A: Discrete Item - Low Stock', () => {
        it('should detect low stock for 3 eggs with 4 members', async () => {
            const fId = await setupFridge(4);

            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({
                    isRunningLow: true,
                    reasoning: "3 eggs cannot feed 4 people."
                })
            });

            const res = await request(app)
                .post(`/fridges/${fId}/items`)
                .set('Authorization', token)
                .send({
                    name: "Eggs",
                    quantity: "3 pcs",
                    ownership: "SHARED"
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.isRunningLow).toBe(true);

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.contents).toContain("Household Size: 4");
            expect(callArgs.contents).toContain('Item Name: "Eggs"');
            expect(callArgs.contents).toContain('Current Quantity: "3 pcs"');
        });
    });

    describe('Scenario B: Discrete Item - Well Stocked', () => {
        it('should detect sufficient stock for 12 eggs with 2 members', async () => {
            const fId = await setupFridge(2);

            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({
                    isRunningLow: false,
                    reasoning: "12 eggs is plenty."
                })
            });

            const res = await request(app)
                .post(`/fridges/${fId}/items`)
                .set('Authorization', token)
                .send({
                    name: "Eggs",
                    quantity: "12 pcs",
                    ownership: "SHARED"
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.isRunningLow).toBe(false);

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.contents).toContain("Household Size: 2");
        });
    });

    describe('Scenario C: Condiments - Well Stocked', () => {
        it('should handle standard condiments for large household (Shared)', async () => {
            const fId = await setupFridge(5);

            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({
                    isRunningLow: false,
                    reasoning: "1 bottle is standard."
                })
            });

            const res = await request(app)
                .post(`/fridges/${fId}/items`)
                .set('Authorization', token)
                .send({
                    name: "Ketchup",
                    quantity: "1 bottle",
                    ownership: "SHARED"
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.isRunningLow).toBe(false);

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.contents).toContain("Household Size: 5");
            expect(callArgs.contents).toContain('Item Name: "Ketchup"');
        });
    });

    describe('Scenario D: Condiments - Low Stock', () => {
        it('should detect nearly empty condiments for 4 members', async () => {
            const fId = await setupFridge(4);

            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({
                    isRunningLow: true,
                    reasoning: "Empty is empty."
                })
            });

            const res = await request(app)
                .post(`/fridges/${fId}/items`)
                .set('Authorization', token)
                .send({
                    name: "Ketchup",
                    quantity: "0.1 bottle",
                    ownership: "SHARED"
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.isRunningLow).toBe(true);

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.contents).toContain("Household Size: 4");
            expect(callArgs.contents).toContain('Current Quantity: "0.1 bottle"');
        });
    });

    describe('Scenario E: Private Item - Well Stocked', () => {
        it('should evaluate private items against 1 person regardless of fridge size', async () => {
            const fId = await setupFridge(4); // 4 members

            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({
                    isRunningLow: false,
                    reasoning: "One yogurt is sufficient for one person."
                })
            });

            const res = await request(app)
                .post(`/fridges/${fId}/items`)
                .set('Authorization', token)
                .send({
                    name: "Protein Yogurt",
                    quantity: "1 pcs",
                    ownership: "PRIVATE"
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.isRunningLow).toBe(false);

            // CRITICAL: Check that userCount sent to AI was 1
            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.contents).toContain("Household Size: 1");
        });
    });
});
