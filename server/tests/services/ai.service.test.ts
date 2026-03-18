const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: { generateContent: mockGenerateContent }
    }))
}));

import { AIService } from '../../services/ai.service';

describe('AIService Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateRecipes', () => {
        const mockRecipes = [
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
        ];

        it('should generate recipes from ingredients', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify(mockRecipes)
            });

            const result = await AIService.generateRecipes({
                ingredients: ['eggs', 'bread', 'cheese'],
                count: 2
            });

            expect(result.recipes).toHaveLength(2);
            expect(result.recipes[0].title).toBe('Scrambled Eggs');
            expect(result.recipes[1].title).toBe('Cheese Toast');
        });

        it('should include allergies in the prompt', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify(mockRecipes)
            });

            await AIService.generateRecipes({
                ingredients: ['eggs'],
                allergies: ['peanuts', 'shellfish']
            });

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.contents).toContain('peanuts');
            expect(callArgs.contents).toContain('shellfish');
            expect(callArgs.contents).toContain('NEVER include');
        });

        it('should include diet preference in the prompt', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify(mockRecipes)
            });

            await AIService.generateRecipes({
                ingredients: ['eggs'],
                dietPreference: 'VEGAN'
            });

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.contents).toContain('VEGAN');
            expect(callArgs.contents).toContain('vegan recipes');
        });

        it('should handle rate limit error', async () => {
            mockGenerateContent.mockRejectedValueOnce(
                new Error('Resource exhausted: 429 quota exceeded')
            );

            await expect(AIService.generateRecipes({
                ingredients: ['eggs']
            })).rejects.toThrow('rate limit exceeded');
        });

        it('should handle empty AI response', async () => {
            mockGenerateContent.mockResolvedValueOnce({ text: null });

            await expect(AIService.generateRecipes({
                ingredients: ['eggs']
            })).rejects.toThrow('No response from AI');
        });

        it('should handle markdown code blocks in response', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: '```json\n[{"title": "Test", "description": "Test", "cookingTime": "10 min", "difficulty": "Easy", "ingredients": [], "steps": []}]\n```'
            });

            const result = await AIService.generateRecipes({
                ingredients: ['eggs']
            });

            expect(result.recipes).toHaveLength(1);
            expect(result.recipes[0].title).toBe('Test');
        });

        it('should use default count of 3', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify(mockRecipes)
            });

            await AIService.generateRecipes({
                ingredients: ['eggs']
            });

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.contents).toContain('exactly 3 recipes');
        });

        it('should handle malformed JSON response', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: 'This is not valid JSON'
            });

            await expect(AIService.generateRecipes({
                ingredients: ['eggs']
            })).rejects.toThrow('Failed to parse recipe response from AI');
        });
    });

    describe('askAboutRecipe', () => {
        it('should answer a cooking question', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: "With eggs and cheese, you can make an omelette!"
            });

            const result = await AIService.askAboutRecipe(
                'What can I make?',
                undefined,
                ['eggs', 'cheese']
            );

            expect(result).toContain('omelette');
        });

        it('should include recipe context in prompt', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: "You could use tofu instead of eggs."
            });

            await AIService.askAboutRecipe(
                'Can I make this vegan?',
                {
                    title: 'Cheese Omelette',
                    ingredients: [{ name: 'eggs', amount: '3' }, { name: 'cheese', amount: '100g' }],
                    steps: ['Beat eggs', 'Cook in pan']
                }
            );

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.contents).toContain('Cheese Omelette');
            expect(callArgs.contents).toContain('eggs');
            expect(callArgs.contents).toContain('cheese');
        });

        it('should include available ingredients in prompt', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: "You can make pancakes!"
            });

            await AIService.askAboutRecipe(
                'What can I cook?',
                undefined,
                ['eggs', 'milk', 'flour']
            );

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.contents).toContain('eggs');
            expect(callArgs.contents).toContain('milk');
            expect(callArgs.contents).toContain('flour');
        });

        it('should handle rate limit error', async () => {
            mockGenerateContent.mockRejectedValueOnce(
                new Error('Resource exhausted: 429 quota exceeded')
            );

            await expect(AIService.askAboutRecipe(
                'What can I make?',
                undefined,
                ['eggs']
            )).rejects.toThrow('rate limit exceeded');
        });

        it('should return fallback message on empty response', async () => {
            mockGenerateContent.mockResolvedValueOnce({ text: '' });

            const result = await AIService.askAboutRecipe(
                'What can I make?',
                undefined,
                ['eggs']
            );

            expect(result).toBe('Unable to process your request.');
        });

        it('should handle general API error', async () => {
            mockGenerateContent.mockRejectedValueOnce(new Error('Network failure'));

            await expect(AIService.askAboutRecipe(
                'What can I make?',
                undefined,
                ['eggs']
            )).rejects.toThrow('AI service error');
        });
    });
});
