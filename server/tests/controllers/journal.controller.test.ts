import request from 'supertest';
import app from '../../index';
import { token, userId } from '../setup';
import { JournalModel } from '../../models/journal.model';
import Recipe from '../../models/recipe.model';
import mongoose from 'mongoose';

describe('Journal Controller Tests', () => {
    let mockRecipeId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        const recipe = await Recipe.create({
            createdBy: userId,
            title: 'Controller Mock Recipe',
            description: 'Yummy',
            cookingTime: '10m',
            difficulty: 'Easy',
            ingredients: [],
            steps: [],
            nutrition: {},
        });
        mockRecipeId = recipe._id as mongoose.Types.ObjectId;
    });

    describe('POST /journal', () => {
        it('should create a journal entry successfully', async () => {
            const entryData = {
                title: 'My Dinner Log',
                content: 'Steak and broccoli',
                date: new Date().toISOString(),
                meals: [
                    {
                        mealType: 'DINNER',
                        recipeId: mockRecipeId.toString(),
                        calories: 600,
                        notes: 'A bit salty'
                    }
                ],
                rating: 4,
                mood: 'ENERGETIC'
            };

            const res = await request(app)
                .post('/journal')
                .set('Authorization', token)
                .send(entryData);

            expect(res.statusCode).toBe(201);
            expect(res.body.ok).toBe(true);
            expect(res.body.data.title).toBe(entryData.title);
            expect(res.body.data.content).toBe(entryData.content);
            expect(res.body.data.meals[0].mealType).toBe('DINNER');
            expect(res.body.data.meals[0].recipeId).toBe(mockRecipeId.toString());
        });

        it('should return 400 validation error for missing title', async () => {
            const entryData = {
                content: 'No title entry'
            };

            const res = await request(app)
                .post('/journal')
                .set('Authorization', token)
                .send(entryData);

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Validation error');
        });
    });

    describe('GET /journal', () => {
        beforeEach(async () => {
            await JournalModel.create([
                {
                    userId,
                    title: 'Yesterday Log',
                    date: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    meals: []
                },
                {
                    userId,
                    title: 'Today Log',
                    date: new Date(),
                    meals: []
                }
            ]);
        });

        it('should return paginated list of entries for authenticated user', async () => {
            const res = await request(app)
                .get('/journal?page=1&limit=10')
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(2);
            expect(res.body.total).toBe(2);
            expect(res.body.items[0].title).toBe('Today Log');
        });

        it('should return 401 without token', async () => {
            const res = await request(app).get('/journal');
            expect(res.statusCode).toBe(401);
        });
    });

    describe('GET /journal/:id', () => {
        it('should retrieve specific entry by ID', async () => {
            const entry = await JournalModel.create({
                userId,
                title: 'Specific Log',
                date: new Date(),
                meals: []
            });

            const res = await request(app)
                .get(`/journal/${entry._id}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.data.title).toBe('Specific Log');
        });

        it('should return 404 for other users entry', async () => {
            const otherUserId = new mongoose.Types.ObjectId();
            const entry = await JournalModel.create({
                userId: otherUserId,
                title: 'Other User Log',
                date: new Date(),
                meals: []
            });

            const res = await request(app)
                .get(`/journal/${entry._id}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(404);
        });
    });

    describe('PUT /journal/:id', () => {
        it('should update specific entry', async () => {
            const entry = await JournalModel.create({
                userId,
                title: 'Title to change',
                date: new Date(),
                meals: []
            });

            const res = await request(app)
                .put(`/journal/${entry._id}`)
                .set('Authorization', token)
                .send({ title: 'Changed Title', content: 'Changed notes' });

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.data.title).toBe('Changed Title');
            expect(res.body.data.content).toBe('Changed notes');
        });

        it('should return 404 for updating non-existent entry', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/journal/${fakeId}`)
                .set('Authorization', token)
                .send({ title: 'New title' });

            expect(res.statusCode).toBe(404);
        });
    });

    describe('DELETE /journal/:id', () => {
        it('should delete specific entry', async () => {
            const entry = await JournalModel.create({
                userId,
                title: 'Delete Me',
                date: new Date(),
                meals: []
            });

            const res = await request(app)
                .delete(`/journal/${entry._id}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);

            const check = await JournalModel.findById(entry._id);
            expect(check).toBeNull();
        });

        it('should return 404 when deleting other user entry', async () => {
            const otherUserId = new mongoose.Types.ObjectId();
            const entry = await JournalModel.create({
                userId: otherUserId,
                title: 'Do Not Delete',
                date: new Date(),
                meals: []
            });

            const res = await request(app)
                .delete(`/journal/${entry._id}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(404);
        });
    });
});
