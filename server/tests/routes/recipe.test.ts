import request from 'supertest';
import app from '../../index';
import { token, userId } from '../setup';
import Recipe from '../../models/recipe.model';
import mongoose from 'mongoose';

describe('Recipe Controller Tests', () => {
    const sampleRecipeData = {
        title: 'Test Cheese Omelette',
        description: 'A fluffy cheese omelette',
        cookingTime: '15 minutes',
        difficulty: 'Easy' as const,
        ingredients: [
            { name: 'eggs', amount: '3' },
            { name: 'cheese', amount: '50g' },
        ],
        steps: ['Beat eggs', 'Add cheese', 'Cook in pan'],
        nutrition: {
            calories: '320 kcal',
            protein: '22g',
            carbs: '2g',
            fat: '25g',
        },
        imageUrl: 'https://images.food.com/cheese-omelette.jpg',
    };

    async function createRecipe(overrides: Record<string, unknown> = {}) {
        return Recipe.create({
            ...sampleRecipeData,
            createdBy: new mongoose.Types.ObjectId(userId),
            favoritedBy: [],
            ...overrides,
        });
    }

    describe('POST /recipes/:id/favorite', () => {
        it('should add a recipe to favorites', async () => {
            const recipe = await createRecipe();

            const res = await request(app)
                .post(`/recipes/${recipe._id}/favorite`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Recipe added to favorites');
            expect(res.body.recipe.title).toBe(sampleRecipeData.title);
        });

        it('should return 409 for duplicate favorite', async () => {
            const recipe = await createRecipe({
                favoritedBy: [new mongoose.Types.ObjectId(userId)],
            });

            const res = await request(app)
                .post(`/recipes/${recipe._id}/favorite`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(409);
            expect(res.body.error).toContain('already in favorites');
        });

        it('should return 404 for non-existent recipe', async () => {
            const fakeId = new mongoose.Types.ObjectId();

            const res = await request(app)
                .post(`/recipes/${fakeId}/favorite`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(404);
        });

        it('should return 401 without authorization', async () => {
            const recipe = await createRecipe();

            const res = await request(app)
                .post(`/recipes/${recipe._id}/favorite`);

            expect(res.statusCode).toBe(401);
        });
    });

    describe('DELETE /recipes/:id/favorite', () => {
        it('should remove a recipe from favorites', async () => {
            const recipe = await createRecipe({
                favoritedBy: [new mongoose.Types.ObjectId(userId)],
            });

            const res = await request(app)
                .delete(`/recipes/${recipe._id}/favorite`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toContain('removed');
        });

        it('should return 401 without authorization', async () => {
            const res = await request(app)
                .delete('/recipes/507f1f77bcf86cd799439011/favorite');

            expect(res.statusCode).toBe(401);
        });
    });

    describe('GET /recipes/:id', () => {
        it('should get a recipe by ID', async () => {
            const recipe = await createRecipe();

            const res = await request(app)
                .get(`/recipes/${recipe._id}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.title).toBe(sampleRecipeData.title);
        });

        it('should include isFavorited flag', async () => {
            const recipe = await createRecipe({
                favoritedBy: [new mongoose.Types.ObjectId(userId)],
            });

            const res = await request(app)
                .get(`/recipes/${recipe._id}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.isFavorited).toBe(true);
        });

        it('should return 404 for non-existent recipe', async () => {
            const res = await request(app)
                .get('/recipes/507f1f77bcf86cd799439011')
                .set('Authorization', token);

            expect(res.statusCode).toBe(404);
        });

        it('should return 401 without authorization', async () => {
            const res = await request(app)
                .get('/recipes/507f1f77bcf86cd799439011');

            expect(res.statusCode).toBe(401);
        });
    });

    describe('GET /user/me/recipes', () => {
        beforeEach(async () => {
            await createRecipe({
                title: 'Favorite 1',
                favoritedBy: [new mongoose.Types.ObjectId(userId)],
            });
            await createRecipe({
                title: 'Favorite 2',
                favoritedBy: [new mongoose.Types.ObjectId(userId)],
            });
        });

        it('should get user favorite recipes', async () => {
            const res = await request(app)
                .get('/user/me/recipes')
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.items.length).toBeGreaterThanOrEqual(2);
        });

        it('should support pagination', async () => {
            const res = await request(app)
                .get('/user/me/recipes?page=1&limit=1')
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.items.length).toBeLessThanOrEqual(1);
            expect(res.body.page).toBe(1);
            expect(res.body.limit).toBe(1);
        });

        it('should return 401 without authorization', async () => {
            const res = await request(app)
                .get('/user/me/recipes');

            expect(res.statusCode).toBe(401);
        });
    });

    describe('DELETE /user/me/recipes/:id', () => {
        it('should delete a recipe from favorites', async () => {
            const recipe = await createRecipe({
                favoritedBy: [new mongoose.Types.ObjectId(userId)],
            });

            const res = await request(app)
                .delete(`/user/me/recipes/${recipe._id}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toContain('removed');
        });

        it('should return 401 without authorization', async () => {
            const res = await request(app)
                .delete('/user/me/recipes/507f1f77bcf86cd799439011');

            expect(res.statusCode).toBe(401);
        });
    });
});
