import request from 'supertest';
import app from '../../index';
import { token, userId } from '../setup';
import Recipe from '../../models/recipe.model';

const testUserId = userId;

describe('Recipe Controller Tests', () => {
    const sampleRecipe = {
        title: 'Test Cheese Omelette',
        description: 'A fluffy cheese omelette',
        cookingTime: '15 minutes',
        difficulty: 'Easy',
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
    };

    describe('POST /recipes/save', () => {
        it('should save a recipe to favorites', async () => {
            const res = await request(app)
                .post('/recipes/save')
                .set('Authorization', token)
                .send(sampleRecipe);

            expect(res.statusCode).toBe(201);
            expect(res.body.message).toBe('Recipe saved to favorites');
            expect(res.body.recipe.title).toBe(sampleRecipe.title);
        });

        it('should return 409 for duplicate recipe', async () => {
            // First save
            await request(app)
                .post('/recipes/save')
                .set('Authorization', token)
                .send({ title: 'Unique Recipe' });

            // Try to save again
            const res = await request(app)
                .post('/recipes/save')
                .set('Authorization', token)
                .send({ title: 'Unique Recipe' });

            expect(res.statusCode).toBe(409);
            expect(res.body.error).toContain('already saved');
        });

        it('should return 400 if title is missing', async () => {
            const res = await request(app)
                .post('/recipes/save')
                .set('Authorization', token)
                .send({ description: 'No title recipe' });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('title');
        });

        it('should return 403 without authorization', async () => {
            const res = await request(app)
                .post('/recipes/save')
                .send(sampleRecipe);

            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET /recipes/:id', () => {
        it('should get a recipe by ID', async () => {
            // First create a recipe
            const createRes = await request(app)
                .post('/recipes/save')
                .set('Authorization', token)
                .send({ title: 'Recipe to Fetch' });

            const recipeId = createRes.body.recipe._id;

            const res = await request(app)
                .get(`/recipes/${recipeId}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.title).toBe('Recipe to Fetch');
        });

        it('should return 404 for non-existent recipe', async () => {
            const res = await request(app)
                .get('/recipes/507f1f77bcf86cd799439011')
                .set('Authorization', token);

            expect(res.statusCode).toBe(404);
        });

        it('should return 403 without authorization', async () => {
            const res = await request(app)
                .get('/recipes/507f1f77bcf86cd799439011');

            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET /user/me/recipes', () => {
        beforeEach(async () => {
            // Create some test recipes
            await Recipe.create([
                { userId: testUserId, title: 'Favorite 1' },
                { userId: testUserId, title: 'Favorite 2' },
            ]);
        });

        it('should get user recipes', async () => {
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

        it('should return 403 without authorization', async () => {
            const res = await request(app)
                .get('/user/me/recipes');

            expect(res.statusCode).toBe(403);
        });
    });

    describe('DELETE /user/me/recipes/:id', () => {
        it('should delete a recipe from favorites', async () => {
            // First create a recipe
            const createRes = await request(app)
                .post('/recipes/save')
                .set('Authorization', token)
                .send({ title: 'Recipe to Delete' });

            const recipeId = createRes.body.recipe._id;

            const res = await request(app)
                .delete(`/user/me/recipes/${recipeId}`)
                .set('Authorization', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toContain('removed');

            // Verify it's deleted
            const getRes = await request(app)
                .get(`/recipes/${recipeId}`)
                .set('Authorization', token);

            expect(getRes.statusCode).toBe(404);
        });

        it('should return 404 for non-existent recipe', async () => {
            const res = await request(app)
                .delete('/user/me/recipes/507f1f77bcf86cd799439011')
                .set('Authorization', token);

            expect(res.statusCode).toBe(404);
        });

        it('should return 403 without authorization', async () => {
            const res = await request(app)
                .delete('/user/me/recipes/507f1f77bcf86cd799439011');

            expect(res.statusCode).toBe(403);
        });
    });
});

