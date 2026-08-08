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
            })).rejects.toMatchObject({
                status: 429,
                message: expect.stringMatching(/busy/i),
            });
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
        it('should detect items from a valid image', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({
                    imageIssue: null,
                    items: [
                        { name: 'egg', quantity: '6', confidence: 'high' },
                        { name: 'milk', quantity: '1 liter', confidence: 'high' },
                    ],
                }),
            });

            const result = await AIService.detectFridgeItems(Buffer.from('fake-image'), 'image/jpeg');

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Egg');
            expect(result[1].quantity).toBe('1 liter');
        });

        it('should handle markdown-wrapped JSON in response', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: '```json\n{"imageIssue":null,"items":[{"name":"apple","quantity":"3","confidence":"high"}]}\n```',
            });

            const result = await AIService.detectFridgeItems(Buffer.from('img'), 'image/png');
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Apple');
        });

        it('should accept a legacy raw array response (backward compatible fallback)', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify([{ name: 'apple', quantity: '3', confidence: 'high' }]),
            });

            const result = await AIService.detectFridgeItems(Buffer.from('img'), 'image/png');
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Apple');
        });

        it('should throw BAD_SCAN_IMAGE when the photo is too blurry', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ imageIssue: 'too_blurry', items: [] }),
            });

            await expect(
                AIService.detectFridgeItems(Buffer.from('img'), 'image/jpeg')
            ).rejects.toMatchObject({ status: 400, code: 'BAD_SCAN_IMAGE' });
        });

        it('should throw BAD_SCAN_IMAGE when the photo is not a fridge', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ imageIssue: 'not_a_fridge', items: [] }),
            });

            await expect(
                AIService.detectFridgeItems(Buffer.from('img'), 'image/jpeg')
            ).rejects.toMatchObject({ status: 400, code: 'BAD_SCAN_IMAGE' });
        });

        it('should throw BAD_SCAN_IMAGE when the photo is too dark', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ imageIssue: 'too_dark', items: [] }),
            });

            await expect(
                AIService.detectFridgeItems(Buffer.from('img'), 'image/jpeg')
            ).rejects.toMatchObject({ status: 400, code: 'BAD_SCAN_IMAGE' });
        });

        it('should return empty items when imageIssue is null but fridge is empty', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ imageIssue: null, items: [] }),
            });

            const result = await AIService.detectFridgeItems(Buffer.from('img'), 'image/jpeg');
            expect(result).toEqual([]);
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
            ).rejects.toThrow('Scan failed — please try again.');
        });

        it('should filter out items missing name or quantity', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({
                    imageIssue: null,
                    items: [
                        { name: 'egg', quantity: '6', confidence: 'high' },
                        { name: '', quantity: '3', confidence: 'high' },
                        { name: 'milk', quantity: '', confidence: 'high' },
                        { name: 'butter', quantity: '1 block', confidence: 'high' },
                    ],
                }),
            });

            const result = await AIService.detectFridgeItems(Buffer.from('img'), 'image/jpeg');
            expect(result).toHaveLength(2);
            expect(result.map(i => i.name)).toEqual(['Egg', 'Butter']);
        });
    });

    describe('getConsumptionProfiles', () => {
        const profileJson = (name: string, overrides: Record<string, number> = {}) => ({
            name,
            pieceServings: 1,
            packageServings: 8,
            gramsPerServing: 250,
            mlPerServing: 250,
            servingsPerPersonPerWeek: 4,
            ...overrides,
        });

        it('returns a profile per requested item', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify([
                    profileJson('Milk'),
                    profileJson('Ketchup', { packageServings: 30, servingsPerPersonPerWeek: 0.5 }),
                ]),
            });

            const result = await AIService.getConsumptionProfiles(['Milk', 'Ketchup']);
            expect(result.get('Milk')?.packageServings).toBe(8);
            expect(result.get('Ketchup')?.servingsPerPersonPerWeek).toBe(0.5);
        });

        it('asks for per-person figures and lists every requested item', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify([profileJson('Milk')]),
            });

            await AIService.getConsumptionProfiles(['Milk']);
            const prompt = mockGenerateContent.mock.calls[0][0].contents;
            expect(prompt).toContain('"Milk"');
            expect(prompt).toContain('PER-PERSON');
        });

        it('keeps a zero weekly consumption, so non-food items stay un-flagged', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify([profileJson('Plastic Container', { servingsPerPersonPerWeek: 0 })]),
            });

            const result = await AIService.getConsumptionProfiles(['Plastic Container']);
            expect(result.get('Plastic Container')?.servingsPerPersonPerWeek).toBe(0);
        });

        it('substitutes defaults for missing or nonsensical numbers', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify([{ name: 'Mystery', packageServings: -3 }]),
            });

            const profile = (await AIService.getConsumptionProfiles(['Mystery'])).get('Mystery');
            expect(profile?.packageServings).toBeGreaterThan(0);
            expect(profile?.pieceServings).toBeGreaterThan(0);
            expect(profile?.servingsPerPersonPerWeek).toBe(0);
        });

        it('returns an empty map for an empty request without calling the AI', async () => {
            const result = await AIService.getConsumptionProfiles([]);
            expect(result.size).toBe(0);
            expect(mockGenerateContent).not.toHaveBeenCalled();
        });

        it('returns an empty map on AI failure', async () => {
            mockGenerateContent.mockRejectedValueOnce(new Error('AI down'));
            const result = await AIService.getConsumptionProfiles(['Milk']);
            expect(result.size).toBe(0);
        });

        it('handles a response wrapped in a markdown code block', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: `\`\`\`json\n${JSON.stringify([profileJson('Milk')])}\n\`\`\``,
            });

            const result = await AIService.getConsumptionProfiles(['Milk']);
            expect(result.get('Milk')?.packageServings).toBe(8);
        });

        it('handles trailing commas in the response', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: `[${JSON.stringify(profileJson('Milk'))},]`,
            });

            const result = await AIService.getConsumptionProfiles(['Milk']);
            expect(result.get('Milk')).toBeDefined();
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

    describe('_extractKeywords', () => {
        it('drops stop-words and short tokens; returns the first 1-2 keywords', () => {
            const kws = (AIService as any)._extractKeywords('The Best Classic Homemade Beef Stew');
            expect(kws[0]).toBe('beef stew');
            expect(kws).toContain('beef');
            expect(kws).toContain('stew');
        });

        it('returns a single-word list when only one keyword remains', () => {
            const kws = (AIService as any)._extractKeywords('Simple Cake');
            expect(kws).toEqual(['cake']);
        });

        it('falls back to the lowercased title when all words are stop-words', () => {
            const kws = (AIService as any)._extractKeywords('The Best Recipe');
            expect(kws).toEqual(['the best recipe']);
        });
    });

    describe('_tryAIImageSearch', () => {
        const axios = require('axios');
        const origGet = axios.get;

        afterEach(() => {
            axios.get = origGet;
        });

        it('returns null when TheMealDB has no matches and there is no Spoonacular key', async () => {
            const origSpoon = process.env.SPOONACULAR_API_KEY;
            delete process.env.SPOONACULAR_API_KEY;
            axios.get = jest.fn().mockResolvedValue({ data: { meals: null } });

            const result = await (AIService as any)._tryAIImageSearch('Pizza');
            expect(result).toBeNull();

            if (origSpoon !== undefined) process.env.SPOONACULAR_API_KEY = origSpoon;
        });

        it('returns null when both providers return nothing (with a Spoonacular key set)', async () => {
            const origSpoon = process.env.SPOONACULAR_API_KEY;
            process.env.SPOONACULAR_API_KEY = 'k';
            axios.get = jest.fn().mockResolvedValue({ data: { meals: null, results: [] } });

            const result = await (AIService as any)._tryAIImageSearch('Salad Bowl');
            expect(result).toBeNull();

            if (origSpoon === undefined) delete process.env.SPOONACULAR_API_KEY;
            else process.env.SPOONACULAR_API_KEY = origSpoon;
        });

        it('gracefully swallows network errors from TheMealDB and Spoonacular', async () => {
            const origSpoon = process.env.SPOONACULAR_API_KEY;
            process.env.SPOONACULAR_API_KEY = 'k';
            axios.get = jest.fn().mockRejectedValue(new Error('network'));

            const result = await (AIService as any)._tryAIImageSearch('Pancakes');
            expect(result).toBeNull();

            if (origSpoon === undefined) delete process.env.SPOONACULAR_API_KEY;
            else process.env.SPOONACULAR_API_KEY = origSpoon;
        });
    });

    describe('_downloadImageToUploads', () => {
        const axios = require('axios');
        const origGet = axios.get;

        afterEach(() => {
            axios.get = origGet;
        });

        it('returns null when the image download fails', async () => {
            axios.get = jest.fn().mockRejectedValue(new Error('boom'));
            const result = await (AIService as any)._downloadImageToUploads('https://example.com/x.jpg');
            expect(result).toBeNull();
        });
    });

    describe('generateRecipeImage — full fallback chain', () => {
        const axios = require('axios');
        const origGet = axios.get;

        afterEach(() => {
            axios.get = origGet;
        });

        it('returns null when there is no image API key AND external search fails', async () => {
            const origKey = process.env.GEMINI_IMAGE_API_KEY;
            const origSpoon = process.env.SPOONACULAR_API_KEY;
            delete process.env.GEMINI_IMAGE_API_KEY;
            delete process.env.SPOONACULAR_API_KEY;
            axios.get = jest.fn().mockResolvedValue({ data: { meals: null } });

            const result = await AIService.generateRecipeImage('nothing');
            expect(result).toBeNull();

            if (origKey !== undefined) process.env.GEMINI_IMAGE_API_KEY = origKey;
            if (origSpoon !== undefined) process.env.SPOONACULAR_API_KEY = origSpoon;
        });

        it('falls back to search when the image API returns no inlineData', async () => {
            const origKey = process.env.GEMINI_IMAGE_API_KEY;
            const origSpoon = process.env.SPOONACULAR_API_KEY;
            process.env.GEMINI_IMAGE_API_KEY = 'test-image-key';
            delete process.env.SPOONACULAR_API_KEY;

            // Image AI returns text-only response → no inlineData → falls back
            mockGenerateContent.mockResolvedValueOnce({
                candidates: [{ content: { parts: [{ text: 'no image here' }] } }],
            });
            axios.get = jest.fn().mockResolvedValue({ data: { meals: null } });

            const result = await AIService.generateRecipeImage('Test Dish');
            expect(result).toBeNull();

            if (origKey === undefined) delete process.env.GEMINI_IMAGE_API_KEY;
            else process.env.GEMINI_IMAGE_API_KEY = origKey;
            if (origSpoon !== undefined) process.env.SPOONACULAR_API_KEY = origSpoon;
        });

        it('falls back to search when the image API response has no candidates.parts', async () => {
            const origKey = process.env.GEMINI_IMAGE_API_KEY;
            process.env.GEMINI_IMAGE_API_KEY = 'test-image-key';
            mockGenerateContent.mockResolvedValueOnce({ candidates: [] });
            axios.get = jest.fn().mockResolvedValue({ data: { meals: null } });

            const result = await AIService.generateRecipeImage('Test Dish');
            expect(result).toBeNull();

            if (origKey === undefined) delete process.env.GEMINI_IMAGE_API_KEY;
            else process.env.GEMINI_IMAGE_API_KEY = origKey;
        });
    });

    describe('getConsumptionProfiles — parsing edge cases', () => {
        it('returns an empty map when the AI response is empty', async () => {
            mockGenerateContent.mockResolvedValueOnce({ text: '' });
            const map = await AIService.getConsumptionProfiles(['x']);
            expect(map.size).toBe(0);
        });

        it('salvages a truncated array rather than throwing', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: 'here is the data [{"name":"a","packageServings":4,"servingsPerPersonPerWeek":2}',
            });
            const map = await AIService.getConsumptionProfiles(['a']);
            expect(map).toBeInstanceOf(Map);
        });

        it('returns an empty map when the AI response is unparseable JSON', async () => {
            mockGenerateContent.mockResolvedValueOnce({ text: 'not json at all' });
            const map = await AIService.getConsumptionProfiles(['a']);
            expect(map.size).toBe(0);
        });

        it('skips entries with no name', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify([{ packageServings: 4, servingsPerPersonPerWeek: 2 }]),
            });
            const map = await AIService.getConsumptionProfiles(['a']);
            expect(map.size).toBe(0);
        });
    });

    describe('detectFridgeItems — parseScanResponse resilience', () => {
        it('accepts a raw JSON array (no wrapper object)', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify([{ name: 'Egg', quantity: '6', confidence: 'high' }]),
            });
            const buffer = Buffer.from('fake');
            const result = await AIService.detectFridgeItems(buffer, 'image/jpeg');
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Egg');
        });

        it('throws 502 when the AI text contains no JSON object or array', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: 'the moon is beautiful tonight',
            });
            const buffer = Buffer.from('fake');
            await expect(
                AIService.detectFridgeItems(buffer, 'image/jpeg')
            ).rejects.toMatchObject({ status: 502 });
        });

        it('throws 502 when the JSON object candidate is itself invalid', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: 'garbage { not: real json',
            });
            const buffer = Buffer.from('fake');
            await expect(
                AIService.detectFridgeItems(buffer, 'image/jpeg')
            ).rejects.toMatchObject({ status: 502 });
        });

        it('coerces an unexpected imageIssue value to null', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ imageIssue: 'someone_ate_it', items: [] }),
            });
            const buffer = Buffer.from('fake');
            const result = await AIService.detectFridgeItems(buffer, 'image/jpeg');
            expect(result).toEqual([]);
        });
    });
});
