// Mock axios before importing the service
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Import after mocking
import { AIService } from '../../services/ai.service';

describe('AIService Tests', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv, GEMINI_API_KEY: 'test-api-key' };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('generateRecipes', () => {
        const mockRecipeResponse = {
            data: {
                candidates: [{
                    content: {
                        parts: [{
                            text: JSON.stringify([
                                {
                                    title: "Scrambled Eggs",
                                    description: "Simple scrambled eggs",
                                    cookingTime: "10 minutes",
                                    difficulty: "Easy",
                                    ingredients: [{ name: "eggs", amount: "3" }],
                                    steps: ["Crack eggs", "Cook"],
                                    nutrition: { calories: "200 kcal" }
                                },
                                {
                                    title: "Cheese Toast",
                                    description: "Toasted bread with cheese",
                                    cookingTime: "5 minutes",
                                    difficulty: "Easy",
                                    ingredients: [{ name: "bread", amount: "2 slices" }],
                                    steps: ["Toast bread", "Add cheese"],
                                    nutrition: { calories: "250 kcal" }
                                }
                            ])
                        }]
                    }
                }]
            }
        };

        it('should generate recipes from ingredients', async () => {
            mockedAxios.post.mockResolvedValueOnce(mockRecipeResponse);

            const result = await AIService.generateRecipes({
                ingredients: ['eggs', 'bread', 'cheese'],
                count: 2
            });

            expect(result.recipes).toHaveLength(2);
            expect(result.recipes[0].title).toBe('Scrambled Eggs');
            expect(result.recipes[1].title).toBe('Cheese Toast');
        });

        it('should include allergies in the prompt', async () => {
            mockedAxios.post.mockResolvedValueOnce(mockRecipeResponse);

            await AIService.generateRecipes({
                ingredients: ['eggs'],
                allergies: ['peanuts', 'shellfish']
            });

            const callArgs = mockedAxios.post.mock.calls[0];
            const requestBody = callArgs[1] as any;
            const prompt = requestBody.contents[0].parts[0].text;
            
            expect(prompt).toContain('peanuts');
            expect(prompt).toContain('shellfish');
            expect(prompt).toContain('NEVER include');
        });

        it('should include diet preference in the prompt', async () => {
            mockedAxios.post.mockResolvedValueOnce(mockRecipeResponse);

            await AIService.generateRecipes({
                ingredients: ['eggs'],
                dietPreference: 'VEGAN'
            });

            const callArgs = mockedAxios.post.mock.calls[0];
            const requestBody = callArgs[1] as any;
            const prompt = requestBody.contents[0].parts[0].text;
            
            expect(prompt).toContain('VEGAN');
            expect(prompt).toContain('vegan recipes');
        });

        it('should throw error if API key is missing', async () => {
            delete process.env.GEMINI_API_KEY;

            await expect(AIService.generateRecipes({
                ingredients: ['eggs']
            })).rejects.toThrow('GEMINI_API_KEY is not configured');
        });

        it('should handle rate limit error', async () => {
            mockedAxios.post.mockRejectedValueOnce({
                response: { status: 429 }
            });

            await expect(AIService.generateRecipes({
                ingredients: ['eggs']
            })).rejects.toThrow('rate limit exceeded');
        });

        it('should handle empty AI response', async () => {
            mockedAxios.post.mockResolvedValueOnce({
                data: { candidates: [] }
            });

            await expect(AIService.generateRecipes({
                ingredients: ['eggs']
            })).rejects.toThrow('No response from AI');
        });

        it('should handle markdown code blocks in response', async () => {
            const responseWithMarkdown = {
                data: {
                    candidates: [{
                        content: {
                            parts: [{
                                text: '```json\n[{"title": "Test", "description": "Test", "cookingTime": "10 min", "difficulty": "Easy", "ingredients": [], "steps": []}]\n```'
                            }]
                        }
                    }]
                }
            };
            mockedAxios.post.mockResolvedValueOnce(responseWithMarkdown);

            const result = await AIService.generateRecipes({
                ingredients: ['eggs']
            });

            expect(result.recipes).toHaveLength(1);
            expect(result.recipes[0].title).toBe('Test');
        });

        it('should use default count of 3', async () => {
            mockedAxios.post.mockResolvedValueOnce(mockRecipeResponse);

            await AIService.generateRecipes({
                ingredients: ['eggs']
            });

            const callArgs = mockedAxios.post.mock.calls[0];
            const requestBody = callArgs[1] as any;
            const prompt = requestBody.contents[0].parts[0].text;
            
            expect(prompt).toContain('exactly 3 recipes');
        });

        it('should handle malformed JSON response', async () => {
            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    candidates: [{
                        content: {
                            parts: [{
                                text: 'This is not valid JSON'
                            }]
                        }
                    }]
                }
            });

            await expect(AIService.generateRecipes({
                ingredients: ['eggs']
            })).rejects.toThrow('Failed to parse recipe response from AI');
        });
    });

    describe('askAboutRecipe', () => {
        const mockAskResponse = {
            data: {
                candidates: [{
                    content: {
                        parts: [{
                            text: "With eggs and cheese, you can make an omelette!"
                        }]
                    }
                }]
            }
        };

        it('should answer a cooking question', async () => {
            mockedAxios.post.mockResolvedValueOnce(mockAskResponse);

            const result = await AIService.askAboutRecipe(
                'What can I make?',
                undefined,
                ['eggs', 'cheese']
            );

            expect(result).toContain('omelette');
        });

        it('should include recipe context in prompt', async () => {
            mockedAxios.post.mockResolvedValueOnce(mockAskResponse);

            await AIService.askAboutRecipe(
                'Can I make this vegan?',
                { 
                    title: 'Cheese Omelette',
                    ingredients: [{ name: 'eggs', amount: '3' }, { name: 'cheese', amount: '100g' }],
                    steps: ['Beat eggs', 'Cook in pan']
                }
            );

            const callArgs = mockedAxios.post.mock.calls[0];
            const requestBody = callArgs[1] as any;
            const prompt = requestBody.contents[0].parts[0].text;
            
            expect(prompt).toContain('Cheese Omelette');
            expect(prompt).toContain('eggs');
            expect(prompt).toContain('cheese');
        });

        it('should include available ingredients in prompt', async () => {
            mockedAxios.post.mockResolvedValueOnce(mockAskResponse);

            await AIService.askAboutRecipe(
                'What can I cook?',
                undefined,
                ['eggs', 'milk', 'flour']
            );

            const callArgs = mockedAxios.post.mock.calls[0];
            const requestBody = callArgs[1] as any;
            const prompt = requestBody.contents[0].parts[0].text;
            
            expect(prompt).toContain('eggs');
            expect(prompt).toContain('milk');
            expect(prompt).toContain('flour');
        });

        it('should throw error if API key is missing', async () => {
            delete process.env.GEMINI_API_KEY;

            await expect(AIService.askAboutRecipe(
                'What can I make?',
                undefined,
                ['eggs']
            )).rejects.toThrow('GEMINI_API_KEY is not configured');
        });

        it('should handle rate limit error', async () => {
            mockedAxios.post.mockRejectedValueOnce({
                response: { status: 429 }
            });

            await expect(AIService.askAboutRecipe(
                'What can I make?',
                undefined,
                ['eggs']
            )).rejects.toThrow('rate limit exceeded');
        });

        it('should return fallback message on empty response', async () => {
            mockedAxios.post.mockResolvedValueOnce({
                data: { candidates: [{ content: { parts: [{ text: '' }] } }] }
            });

            const result = await AIService.askAboutRecipe(
                'What can I make?',
                undefined,
                ['eggs']
            );

            expect(result).toBe('Unable to process your request.');
        });

        it('should handle general API error', async () => {
            mockedAxios.post.mockRejectedValueOnce(new Error('Network failure'));

            await expect(AIService.askAboutRecipe(
                'What can I make?',
                undefined,
                ['eggs']
            )).rejects.toThrow('AI service error');
        });
    });
});
