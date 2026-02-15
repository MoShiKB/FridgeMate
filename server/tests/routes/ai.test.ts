import request from 'supertest';
import app from '../../index';
import { token } from '../setup';

jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AI Controller Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /ai/recipes/generate', () => {
        const mockGeminiResponse = {
            data: {
                candidates: [{
                    content: {
                        parts: [{
                            text: JSON.stringify([
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
                            ])
                        }]
                    }
                }]
            }
        };

        it('should generate recipes successfully', async () => {
            mockedAxios.post.mockResolvedValueOnce(mockGeminiResponse);

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
            mockedAxios.post.mockResolvedValueOnce(mockGeminiResponse);

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
            expect(mockedAxios.post).toHaveBeenCalled();
            const callArgs = mockedAxios.post.mock.calls[0];
            const requestBody = callArgs[1] as any;
            expect(requestBody.contents[0].parts[0].text).toContain('peanuts');
            expect(requestBody.contents[0].parts[0].text).toContain('VEGETARIAN');
        });

        it('should return 400 if ingredients is missing', async () => {
            const res = await request(app)
                .post('/ai/recipes/generate')
                .set('Authorization', token)
                .send({});

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('ingredients');
        });

        it('should return 400 if ingredients is empty array', async () => {
            const res = await request(app)
                .post('/ai/recipes/generate')
                .set('Authorization', token)
                .send({ ingredients: [] });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('ingredients');
        });

        it('should return 403 without authorization', async () => {
            const res = await request(app)
                .post('/ai/recipes/generate')
                .send({ ingredients: ['eggs'] });

            expect(res.statusCode).toBe(403);
        });

        it('should handle AI rate limit error', async () => {
            mockedAxios.post.mockRejectedValueOnce({
                response: { status: 429 }
            });

            const res = await request(app)
                .post('/ai/recipes/generate')
                .set('Authorization', token)
                .send({ ingredients: ['eggs', 'cheese'] });

            expect(res.statusCode).toBe(400);
            expect(res.text).toContain('rate limit');
        });

        it('should handle AI service error', async () => {
            mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

            const res = await request(app)
                .post('/ai/recipes/generate')
                .set('Authorization', token)
                .send({ ingredients: ['eggs', 'cheese'] });

            expect(res.statusCode).toBe(400);
            expect(res.text).toContain('AI service error');
        });
    });

    describe('POST /ai/ask', () => {
        const mockAskResponse = {
            data: {
                candidates: [{
                    content: {
                        parts: [{
                            text: "You can make a delicious omelette with eggs and cheese!"
                        }]
                    }
                }]
            }
        };

        it('should answer a cooking question successfully', async () => {
            mockedAxios.post.mockResolvedValueOnce(mockAskResponse);

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
            mockedAxios.post.mockResolvedValueOnce(mockAskResponse);

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
            expect(res.body.error).toContain('query');
        });

        it('should return 403 without authorization', async () => {
            const res = await request(app)
                .post('/ai/ask')
                .send({ query: 'test' });

            expect(res.statusCode).toBe(403);
        });

        it('should handle AI rate limit error', async () => {
            mockedAxios.post.mockRejectedValueOnce({
                response: { status: 429 }
            });

            const res = await request(app)
                .post('/ai/ask')
                .set('Authorization', token)
                .send({ query: 'What can I cook?' });

            expect(res.statusCode).toBe(400);
            expect(res.text).toContain('rate limit');
        });
    });
});
