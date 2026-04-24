import mongoose from 'mongoose';
import InventoryItemModel from '../../models/inventory-item.model';

describe('InventoryItemModel', () => {
    const fridgeId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();

    describe('toJSON transform', () => {
        it('should convert _id to id and strip __v', async () => {
            const item = await InventoryItemModel.create({
                fridgeId,
                ownerId,
                name: 'Egg',
                quantity: '6',
                ownership: 'SHARED',
            });

            const json = item.toJSON();

            expect(json).toHaveProperty('id');
            expect(json).not.toHaveProperty('_id');
            expect(json).not.toHaveProperty('__v');
            expect((json as any).id).toBe(item._id.toString());
        });
    });

    describe('schema defaults', () => {
        it('should default isRunningLow to false', async () => {
            const item = await InventoryItemModel.create({
                fridgeId,
                ownerId,
                name: 'Milk',
                quantity: '1 liter',
                ownership: 'PRIVATE',
            });

            expect(item.isRunningLow).toBe(false);
        });

        it('should default ownership to PRIVATE', async () => {
            const item = await InventoryItemModel.create({
                fridgeId,
                ownerId,
                name: 'Butter',
                quantity: '1 block',
            });

            expect(item.ownership).toBe('PRIVATE');
        });
    });

    describe('validations', () => {
        it('should reject invalid ownership value', async () => {
            await expect(
                InventoryItemModel.create({
                    fridgeId,
                    ownerId,
                    name: 'Apple',
                    quantity: '5',
                    ownership: 'PUBLIC' as any,
                })
            ).rejects.toThrow();
        });

        it('should require name', async () => {
            await expect(
                InventoryItemModel.create({
                    fridgeId,
                    ownerId,
                    quantity: '5',
                    ownership: 'SHARED',
                })
            ).rejects.toThrow();
        });

        it('should require quantity', async () => {
            await expect(
                InventoryItemModel.create({
                    fridgeId,
                    ownerId,
                    name: 'Apple',
                    ownership: 'SHARED',
                })
            ).rejects.toThrow();
        });

        it('should require fridgeId', async () => {
            await expect(
                InventoryItemModel.create({
                    ownerId,
                    name: 'Apple',
                    quantity: '5',
                    ownership: 'SHARED',
                })
            ).rejects.toThrow();
        });
    });

    describe('timestamps', () => {
        it('should auto-set createdAt and updatedAt', async () => {
            const item = await InventoryItemModel.create({
                fridgeId,
                ownerId,
                name: 'Yogurt',
                quantity: '2',
                ownership: 'SHARED',
            });

            expect(item.createdAt).toBeInstanceOf(Date);
            expect(item.updatedAt).toBeInstanceOf(Date);
        });
    });
});
