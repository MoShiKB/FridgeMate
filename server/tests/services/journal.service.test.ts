import mongoose from 'mongoose';
import { JournalService } from '../../services/journal.service';
import { JournalModel } from '../../models/journal.model';
import Recipe from '../../models/recipe.model';
import { userId } from '../setup';

describe('JournalService Tests', () => {
    let mockRecipeId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        // Create a mock recipe to link
        const recipe = await Recipe.create({
            createdBy: userId,
            title: 'Mock Recipe for Journal',
            description: 'Yummy test recipe',
            cookingTime: '20m',
            difficulty: 'Easy',
            ingredients: [{ name: 'Tomato', amount: '2' }],
            steps: ['Chop', 'Cook'],
            nutrition: {},
        });
        mockRecipeId = recipe._id as mongoose.Types.ObjectId;
    });

    describe('create', () => {
        it('should create a journal entry successfully', async () => {
            const entryData = {
                title: 'My Healthy Breakfast',
                content: 'Felt very energetic after this meal.',
                date: new Date().toISOString(),
                meals: [
                    {
                        mealType: 'BREAKFAST',
                        recipeId: mockRecipeId.toString(),
                        calories: 350,
                        notes: 'Delicious breakfast'
                    }
                ],
                rating: 5,
                mood: 'HAPPY',
                imageUrl: 'http://example.com/breakfast.jpg'
            };

            const result = await JournalService.create(userId.toString(), entryData);

            expect(result).toBeDefined();
            expect(result.title).toBe(entryData.title);
            expect(result.content).toBe(entryData.content);
            expect(result.userId.toString()).toBe(userId.toString());
            expect(result.rating).toBe(5);
            expect(result.mood).toBe('HAPPY');
            expect(result.imageUrl).toBe(entryData.imageUrl);
            expect(result.meals).toHaveLength(1);
            expect(result.meals[0].mealType).toBe('BREAKFAST');
            expect(result.meals[0].recipeId?.toString()).toBe(mockRecipeId.toString());
        });

        it('should support custom recipe titles and optional fields', async () => {
            const entryData = {
                title: 'Lunch with custom recipe',
                meals: [
                    {
                        mealType: 'LUNCH',
                        customRecipeTitle: 'Custom Salad Mix'
                    }
                ]
            };

            const result = await JournalService.create(userId.toString(), entryData);

            expect(result).toBeDefined();
            expect(result.title).toBe(entryData.title);
            expect(result.meals).toHaveLength(1);
            expect(result.meals[0].customRecipeTitle).toBe('Custom Salad Mix');
            expect(result.meals[0].recipeId).toBeNull();
        });
    });

    describe('list', () => {
        beforeEach(async () => {
            // Create a few journal entries for listing
            await JournalModel.create([
                {
                    userId,
                    title: 'Entry 1',
                    date: new Date('2026-05-01T10:00:00.000Z'),
                    meals: []
                },
                {
                    userId,
                    title: 'Entry 2',
                    date: new Date('2026-05-15T12:00:00.000Z'),
                    meals: [{ mealType: 'LUNCH', recipeId: mockRecipeId }]
                },
                {
                    userId,
                    title: 'Entry 3',
                    date: new Date('2026-05-20T18:00:00.000Z'),
                    meals: []
                }
            ]);
        });

        it('should retrieve list of user journal entries ordered by date descending', async () => {
            const result = await JournalService.list(userId.toString(), { skip: 0, limit: 10 });

            expect(result.total).toBe(3);
            expect(result.items).toHaveLength(3);
            expect(result.items[0].title).toBe('Entry 3'); // Most recent date
            expect(result.items[1].title).toBe('Entry 2');
            expect(result.items[1].meals[0].recipeId).toBeDefined();
            expect((result.items[1].meals[0].recipeId as any).title).toBe('Mock Recipe for Journal'); // Check population
        });

        it('should filter journal entries by date range', async () => {
            const result = await JournalService.list(userId.toString(), {
                skip: 0,
                limit: 10,
                startDate: '2026-05-10T00:00:00.000Z',
                endDate: '2026-05-18T23:59:59.000Z'
            });

            expect(result.total).toBe(1);
            expect(result.items).toHaveLength(1);
            expect(result.items[0].title).toBe('Entry 2');
        });
    });

    describe('getById', () => {
        it('should retrieve a single entry by ID', async () => {
            const entry = await JournalModel.create({
                userId,
                title: 'Unique Entry',
                date: new Date(),
                meals: [{ mealType: 'SNACK', recipeId: mockRecipeId }]
            });

            const result = await JournalService.getById(userId.toString(), entry._id.toString());

            expect(result).toBeDefined();
            expect(result.title).toBe('Unique Entry');
            expect((result.meals[0].recipeId as any).title).toBe('Mock Recipe for Journal');
        });

        it('should throw 404 error if entry not found', async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            await expect(JournalService.getById(userId.toString(), fakeId))
                .rejects.toHaveProperty('status', 404);
        });

        it('should throw 404 error if entry belongs to another user', async () => {
            const otherUserId = new mongoose.Types.ObjectId();
            const entry = await JournalModel.create({
                userId: otherUserId,
                title: 'Other User Entry',
                date: new Date(),
                meals: []
            });

            await expect(JournalService.getById(userId.toString(), entry._id.toString()))
                .rejects.toHaveProperty('status', 404);
        });
    });

    describe('update', () => {
        it('should update entry successfully', async () => {
            const entry = await JournalModel.create({
                userId,
                title: 'Original Title',
                content: 'Original Content',
                date: new Date('2026-05-22T10:00:00.000Z'),
                meals: []
            });

            const updatedData = {
                title: 'Updated Title',
                content: 'Updated Content',
                meals: [{ mealType: 'DINNER', customRecipeTitle: 'Veggie Soup' }]
            };

            const result = await JournalService.update(userId.toString(), entry._id.toString(), updatedData);

            expect(result).toBeDefined();
            expect(result.title).toBe('Updated Title');
            expect(result.content).toBe('Updated Content');
            expect(result.meals).toHaveLength(1);
            expect(result.meals[0].mealType).toBe('DINNER');
            expect(result.meals[0].customRecipeTitle).toBe('Veggie Soup');
        });

        it('should throw 404 if updating non-existent entry', async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            await expect(JournalService.update(userId.toString(), fakeId, { title: 'New' }))
                .rejects.toHaveProperty('status', 404);
        });
    });

    describe('remove', () => {
        it('should remove entry successfully', async () => {
            const entry = await JournalModel.create({
                userId,
                title: 'To Delete',
                date: new Date(),
                meals: []
            });

            const result = await JournalService.remove(userId.toString(), entry._id.toString());
            expect(result.ok).toBe(true);

            const check = await JournalModel.findById(entry._id);
            expect(check).toBeNull();
        });

        it('should throw 404 when deleting non-existent entry', async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            await expect(JournalService.remove(userId.toString(), fakeId))
                .rejects.toHaveProperty('status', 404);
        });
    });
});
