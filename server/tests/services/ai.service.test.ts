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
            expect(callArgs.contents).toContain('strictly vegan');
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
            expect(callArgs.contents).toContain('up to 3 recipes');
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

        it('should handle recipe with string ingredients', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: "Sure, you can grill the chicken."
            });

            await AIService.askAboutRecipe(
                'How do I cook this?',
                { title: 'Grilled Chicken', ingredients: ['chicken breast', 'olive oil'] as any, steps: [] }
            );

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.contents).toContain('chicken breast');
        });

        it('should work without recipe or ingredients context', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: "A good tip is to preheat the oven."
            });

            const result = await AIService.askAboutRecipe('General cooking tip?');
            expect(result).toContain('preheat');

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.contents).not.toContain('user has these ingredients');
        });
    });

    describe('detectFridgeItems', () => {
        it('should detect items from image', async () => {
            const mockItems = [
                { name: 'egg', quantity: '6' },
                { name: 'milk', quantity: '1 liter' },
            ];
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify(mockItems),
            });

            const buffer = Buffer.from('fake-image');
            const result = await AIService.detectFridgeItems(buffer, 'image/jpeg');

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('egg');
            expect(result[1].quantity).toBe('1 liter');
        });

        it('should handle markdown-wrapped JSON in response', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: '```json\n[{"name":"apple","quantity":"3"}]\n```',
            });

            const result = await AIService.detectFridgeItems(Buffer.from('img'), 'image/png');
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('apple');
        });

        it('should throw 502 on empty response', async () => {
            mockGenerateContent.mockResolvedValueOnce({ text: null });

            await expect(
                AIService.detectFridgeItems(Buffer.from('img'), 'image/jpeg')
            ).rejects.toThrow('No response from AI');
        });

        it('should throw 429 on rate limit error', async () => {
            mockGenerateContent.mockRejectedValueOnce(new Error('429 quota exceeded'));

            await expect(
                AIService.detectFridgeItems(Buffer.from('img'), 'image/jpeg')
            ).rejects.toThrow('rate limit exceeded');
        });

        it('should throw 502 on general error', async () => {
            mockGenerateContent.mockRejectedValueOnce(new Error('Timeout'));

            await expect(
                AIService.detectFridgeItems(Buffer.from('img'), 'image/jpeg')
            ).rejects.toThrow('AI scan service error');
        });

        it('should filter out items missing name or quantity', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify([
                    { name: 'egg', quantity: '6' },
                    { name: '', quantity: '3' },
                    { name: 'milk', quantity: '' },
                    { name: 'butter', quantity: '1 block' },
                ]),
            });

            const result = await AIService.detectFridgeItems(Buffer.from('img'), 'image/jpeg');
            expect(result).toHaveLength(2);
            expect(result.map(i => i.name)).toEqual(['egg', 'butter']);
        });

        it('should return empty array when AI returns non-array object', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ items: [] }),
            });

            const result = await AIService.detectFridgeItems(Buffer.from('img'), 'image/jpeg');
            expect(result).toEqual([]);
        });

        it('should handle incomplete JSON with trailing object', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: '[{"name":"egg","quantity":"6"},{"name":"milk"',
            });

            const result = await AIService.detectFridgeItems(Buffer.from('img'), 'image/jpeg');
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('egg');
        });
    });

    describe('checkIfRunningLow', () => {
        it('should return isRunningLow true', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ isRunningLow: true, reasoning: 'Only 1 egg for 4 people' }),
            });

            const result = await AIService.checkIfRunningLow('egg', '1', 4);
            expect(result.isRunningLow).toBe(true);
            expect(result.reasoning).toContain('1 egg');
        });

        it('should return isRunningLow false', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ isRunningLow: false, reasoning: 'Plenty of milk' }),
            });

            const result = await AIService.checkIfRunningLow('milk', '2 liters', 2);
            expect(result.isRunningLow).toBe(false);
        });

        it('should default to false on AI failure', async () => {
            mockGenerateContent.mockRejectedValueOnce(new Error('AI down'));

            const result = await AIService.checkIfRunningLow('egg', '1', 1);
            expect(result.isRunningLow).toBe(false);
            expect(result.reasoning).toContain('Could not determine');
        });

        it('should default to false on empty AI response', async () => {
            mockGenerateContent.mockResolvedValueOnce({ text: null });

            const result = await AIService.checkIfRunningLow('egg', '1', 1);
            expect(result.isRunningLow).toBe(false);
        });

        it('should default reasoning when AI omits it', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ isRunningLow: true }),
            });

            const result = await AIService.checkIfRunningLow('egg', '1', 1);
            expect(result.isRunningLow).toBe(true);
            expect(result.reasoning).toBe('AI assessment.');
        });
    });

    describe('checkMultipleItemsIfRunningLow', () => {
        it('should return status map for multiple items', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify([
                    { id: 'id1', isRunningLow: true },
                    { id: 'id2', isRunningLow: false },
                ]),
            });

            const items = [
                { id: 'id1', name: 'egg', quantity: '1' },
                { id: 'id2', name: 'milk', quantity: '2 liters' },
            ];

            const result = await AIService.checkMultipleItemsIfRunningLow(items, 3);
            expect(result.get('id1')).toBe(true);
            expect(result.get('id2')).toBe(false);
        });

        it('should return empty map for empty items array', async () => {
            const result = await AIService.checkMultipleItemsIfRunningLow([], 1);
            expect(result.size).toBe(0);
            expect(mockGenerateContent).not.toHaveBeenCalled();
        });

        it('should return empty map on AI failure', async () => {
            mockGenerateContent.mockRejectedValueOnce(new Error('AI down'));

            const result = await AIService.checkMultipleItemsIfRunningLow(
                [{ id: 'id1', name: 'egg', quantity: '1' }],
                1
            );
            expect(result.size).toBe(0);
        });

        it('should handle markdown code blocks in response', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: '```json\n[{"id":"id1","isRunningLow":true}]\n```',
            });

            const result = await AIService.checkMultipleItemsIfRunningLow(
                [{ id: 'id1', name: 'egg', quantity: '1' }],
                2
            );
            expect(result.get('id1')).toBe(true);
        });

        it('should handle trailing commas in response', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: '[{"id":"id1","isRunningLow":false},]',
            });

            const result = await AIService.checkMultipleItemsIfRunningLow(
                [{ id: 'id1', name: 'egg', quantity: '6' }],
                1
            );
            expect(result.get('id1')).toBe(false);
        });
    });

    describe('generateRecipes - parseRecipeResponse edge cases', () => {
        it('should handle recipes with missing optional fields', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify([{ title: 'Minimal' }]),
            });

            const result = await AIService.generateRecipes({ ingredients: ['eggs'] });
            expect(result.recipes[0].title).toBe('Minimal');
            expect(result.recipes[0].description).toBe('');
            expect(result.recipes[0].cookingTime).toBe('Unknown');
            expect(result.recipes[0].steps).toEqual([]);
        });

        it('should handle recipes with cooking_time (snake_case)', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify([{ title: 'Test', cooking_time: '15 min' }]),
            });

            const result = await AIService.generateRecipes({ ingredients: ['eggs'] });
            expect(result.recipes[0].cookingTime).toBe('15 min');
        });

        it('should handle recipes with instructions instead of steps', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify([{ title: 'Test', instructions: ['Step A', 'Step B'] }]),
            });

            const result = await AIService.generateRecipes({ ingredients: ['eggs'] });
            expect(result.recipes[0].steps).toEqual(['Step A', 'Step B']);
        });

        it('should throw 502 when response is not an array', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ recipe: 'not an array' }),
            });

            await expect(
                AIService.generateRecipes({ ingredients: ['eggs'] })
            ).rejects.toThrow('Failed to parse recipe response from AI');
        });

        it('should handle general AI error', async () => {
            mockGenerateContent.mockRejectedValueOnce(new Error('Connection reset'));

            await expect(
                AIService.generateRecipes({ ingredients: ['eggs'] })
            ).rejects.toThrow('AI service error');
        });
    });
});
