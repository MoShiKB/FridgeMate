const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: { generateContent: mockGenerateContent }
    }))
}));

jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

import request from 'supertest';
import app from '../../index';
import { token } from '../setup';

describe('AI Controller Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.get.mockResolvedValue({ data: { meals: null, results: [] } } as any);
    });

    describe('POST /ai/recipes/generate', () => {
        const mockRecipeArray = [
            {
                title: "Test Recipe",
                description: "A test recipe",
                cookingTime: "30 minutes",
                difficulty: "Easy",
                ingredients: [
                    { name: "eggs", amount: "2" },
                    { name: "cheese", amount: "100g" }
                ],
                steps: ["Step 1", "Step 2"],
                nutrition: { calories: "300 kcal" }
            }
        ];

        function mockRecipeGeneration() {
            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify(mockRecipeArray)
            });
        }

        afterEach(() => {
            mockGenerateContent.mockReset();
        });

        it('should generate recipes successfully', async () => {
            mockRecipeGeneration();

            const res = await request(app)
                .post('/ai/recipes/generate')
                .set('Authorization', token)
                .send({
                    ingredients: ['eggs', 'cheese', 'tomatoes'],
                    count: 1
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Recipes generated successfully');
            expect(res.body.recipes).toHaveLength(1);
            expect(res.body.recipes[0].title).toBe('Test Recipe');
        });

        it('should generate recipes with allergies and diet preference', async () => {
            mockRecipeGeneration();

            const res = await request(app)
                .post('/ai/recipes/generate')
                .set('Authorization', token)
                .send({
                    ingredients: ['eggs', 'cheese'],
                    allergies: ['peanuts', 'shellfish'],
                    dietPreference: 'VEGETARIAN',
                    count: 1
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.recipes).toBeDefined();
            expect(mockGenerateContent).toHaveBeenCalled();

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.contents).toContain('peanuts');
            expect(callArgs.contents).toContain('VEGETARIAN');
        });

        it('should return 400 if ingredients is missing', async () => {
            const res = await request(app)
                .post('/ai/recipes/generate')
                .set('Authorization', token)
                .send({});

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Validation error');
        });

        it('should return 400 if ingredients is empty array', async () => {
            const res = await request(app)
                .post('/ai/recipes/generate')
                .set('Authorization', token)
                .send({ ingredients: [] });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Validation error');
        });

        it('should return 401 without authorization', async () => {
            const res = await request(app)
                .post('/ai/recipes/generate')
                .send({ ingredients: ['eggs'] });

            expect(res.statusCode).toBe(401);
        });

        it('should fall back to MealDB recipes when Gemini is rate limited', async () => {
            mockGenerateContent.mockRejectedValueOnce(
                new Error('Resource exhausted: 429 quota exceeded')
            );

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.includes('filter.php')) {
                    return Promise.resolve({
                        data: { meals: [{ idMeal: '52977', strMeal: 'Cheese Omelette', strMealThumb: 'https://example.com/omelette.jpg' }] },
                    } as any);
                }
                if (url.includes('lookup.php')) {
                    return Promise.resolve({
                        data: {
                            meals: [{
                                idMeal: '52977',
                                strMeal: 'Cheese Omelette',
                                strMealThumb: 'https://example.com/omelette.jpg',
                                strCategory: 'Breakfast',
                                strInstructions: 'Beat the eggs.\nAdd cheese.\nCook until golden brown on both sides.',
                                strIngredient1: 'eggs',
                                strMeasure1: '3',
                                strIngredient2: 'cheese',
                                strMeasure2: '50g',
                            }],
                        },
                    } as any);
                }
                return Promise.reject(new Error(`Unexpected axios GET: ${url}`));
            });

            const res = await request(app)
                .post('/ai/recipes/generate')
                .set('Authorization', token)
                .send({ ingredients: ['eggs', 'cheese'] });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Recipes from recipe database');
            expect(res.body.recipes).toHaveLength(1);
            expect(res.body.recipes[0].title).toBe('Cheese Omelette');
        });

        it('should return 503 when Gemini is rate limited AND MealDB has no recipes', async () => {
            mockGenerateContent.mockRejectedValueOnce(
                new Error('Resource exhausted: 429 quota exceeded')
            );

            // MealDB returns no meals → fallback has nothing to return.
            mockedAxios.get.mockResolvedValue({ data: { meals: null } } as any);

            const res = await request(app)
                .post('/ai/recipes/generate')
                .set('Authorization', token)
                .send({ ingredients: ['eggs', 'cheese'] });

            expect(res.statusCode).toBe(503);
            expect(res.body.error).toMatch(/unavailable/i);
        });

        it('should handle AI service error', async () => {
            mockGenerateContent.mockRejectedValueOnce(new Error('Network error'));

            const res = await request(app)
                .post('/ai/recipes/generate')
                .set('Authorization', token)
                .send({ ingredients: ['eggs', 'cheese'] });

            expect(res.statusCode).toBe(502);
            expect(res.body.message).toContain('AI service error');
        });
    });

    describe('POST /ai/ask', () => {
        it('should answer a cooking question successfully', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: "You can make a delicious omelette with eggs and cheese!"
            });

            const res = await request(app)
                .post('/ai/ask')
                .set('Authorization', token)
                .send({
                    query: 'What can I make with eggs and cheese?',
                    ingredients: ['eggs', 'cheese', 'milk']
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.query).toBe('What can I make with eggs and cheese?');
            expect(res.body.answer).toContain('omelette');
            expect(res.body.ingredientsConsidered).toBe(3);
        });

        it('should work without ingredients', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: "Boil water, add eggs for 6-7 minutes."
            });

            const res = await request(app)
                .post('/ai/ask')
                .set('Authorization', token)
                .send({
                    query: 'How do I boil an egg?'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.ingredientsConsidered).toBe(0);
        });

        it('should return 400 if query is missing', async () => {
            const res = await request(app)
                .post('/ai/ask')
                .set('Authorization', token)
                .send({});

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Validation error');
        });

        it('should return 401 without authorization', async () => {
            const res = await request(app)
                .post('/ai/ask')
                .send({ query: 'test' });

            expect(res.statusCode).toBe(401);
        });

        it('should handle AI rate limit error', async () => {
            mockGenerateContent.mockRejectedValueOnce(
                new Error('Resource exhausted: 429 quota exceeded')
            );

            const res = await request(app)
                .post('/ai/ask')
                .set('Authorization', token)
                .send({ query: 'What can I cook?' });

            expect(res.statusCode).toBe(429);
            expect(res.body.message).toContain('rate limit');
        });
    });
});
