import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { UPLOADS_DIR } from '../config/env';
import { ApiError } from '../utils/errors';

// Initialize Gemini AI client
if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const IMAGE_MODEL_NAME = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

interface RecipeGenerationRequest {
    ingredients: string[];
    allergies?: string[];
    dietPreference?: 'NONE' | 'VEGETARIAN' | 'VEGAN' | 'PESCATARIAN';
    count?: number;
}

interface GeneratedRecipe {
    title: string;
    description: string;
    cookingTime: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    ingredients: { name: string; amount: string }[];
    steps: string[];
    nutrition?: {
        calories?: string;
        protein?: string;
        carbs?: string;
        fat?: string;
    };
}

interface AIServiceResponse {
    recipes: GeneratedRecipe[];
    rawResponse?: string;
}

export const AIService = {
    async generateRecipes(request: RecipeGenerationRequest): Promise<AIServiceResponse> {
        const { ingredients, allergies = [], dietPreference = 'NONE', count = 3 } = request;

        const prompt = buildRecipePrompt(ingredients, allergies, dietPreference, count);

        try {
            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
                config: {
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                    responseMimeType: "application/json",
                }
            });

            const textContent = response.text ?? '';

            if (!textContent) {
                throw new ApiError(502, 'No response from AI');
            }

            const recipes = parseRecipeResponse(textContent);

            return {
                recipes,
                rawResponse: textContent
            };
        } catch (error: any) {
            if (error instanceof ApiError) throw error;
            if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate limit') ||
                error.message?.includes('503') || error.message?.includes('UNAVAILABLE') || error.message?.includes('high demand')) {
                throw new ApiError(429, 'AI is busy right now. Please try again in a moment.');
            }
            throw new ApiError(502, `AI service error: ${error.message}`);
        }
    },

    async askAboutRecipe(query: string, recipe?: { title: string; ingredients?: any[]; steps?: string[] }, availableIngredients: string[] = []): Promise<string> {
        let prompt = 'You are a helpful cooking assistant.\n\n';

        // Add recipe context if provided
        if (recipe) {
            prompt += `The user is asking about this recipe:\n`;
            prompt += `Recipe: "${recipe.title}"\n`;
            if (recipe.ingredients && recipe.ingredients.length > 0) {
                const ingredientList = recipe.ingredients.map((i: any) =>
                    typeof i === 'string' ? i : `${i.name} (${i.amount})`
                ).join(', ');
                prompt += `Ingredients: ${ingredientList}\n`;
            }
            if (recipe.steps && recipe.steps.length > 0) {
                prompt += `Steps: ${recipe.steps.join('; ')}\n`;
            }
            prompt += '\n';
        }

        // Add available ingredients if provided
        if (availableIngredients.length > 0) {
            prompt += `The user has these ingredients available: ${availableIngredients.join(', ')}.\n\n`;
        }

        prompt += `User's question: "${query}"\n\n`;
        prompt += `Provide a helpful, concise answer. If they ask about substitutions, variations, or modifications, give specific suggestions.`;

        try {
            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
                config: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
                }
            });

            const textContent = response.text;
            return textContent || 'Unable to process your request.';
        } catch (error: any) {
            if (error instanceof ApiError) throw error;
            if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate limit')) {
                throw new ApiError(429, 'AI rate limit exceeded. Please try again later.');
            }
            throw new ApiError(502, `AI service error: ${error.message}`);
        }
    },

    async generateRecipeImage(recipeTitle: string): Promise<string | null> {
        // 1. AI image generation (requires GEMINI_IMAGE_API_KEY)
        if (process.env.GEMINI_IMAGE_API_KEY) {
            const aiImage = await this._tryAIImageGeneration(recipeTitle);
            if (aiImage) return aiImage;
        }

        // 2. TheMealDB → then Spoonacular
        const searchImage = await this._tryAIImageSearch(recipeTitle);
        if (searchImage) return searchImage;

        return null;
    },

    async _downloadImageToUploads(imageUrl: string): Promise<string | null> {
        try {
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
            const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg';
            const filename = `recipe_${crypto.randomBytes(12).toString('hex')}.${ext}`;
            const filepath = path.join(UPLOADS_DIR, filename);
            await fs.writeFile(filepath, Buffer.from(imageResponse.data));
            return `/uploads/${filename}`;
        } catch (error: any) {
            console.error('Image download failed:', error.message);
            return null;
        }
    },

    async _tryAIImageGeneration(recipeTitle: string): Promise<string | null> {
        const imageApiKey = process.env.GEMINI_IMAGE_API_KEY;
        if (!imageApiKey) return null;

        try {
            const imageAi = new GoogleGenAI({ apiKey: imageApiKey });
            const prompt = `Generate a beautiful, appetizing food photograph of "${recipeTitle}".
            The image should be a professional food photograph, well-plated, natural lighting.
            The image should be a high-quality, professional photograph.
            The image should be a high-resolution photograph.`;

            const response = await imageAi.models.generateContent({
                model: IMAGE_MODEL_NAME,
                contents: prompt,
                config: {
                    responseModalities: ['IMAGE', 'TEXT'] as any,
                },
            });

            const parts = response.candidates?.[0]?.content?.parts;
            if (!parts) return null;

            for (const part of parts) {
                if (part.inlineData?.mimeType?.startsWith('image/')) {
                    const filename = `recipe_${crypto.randomBytes(12).toString('hex')}.png`;
                    const filepath = path.join(UPLOADS_DIR, filename);

                    const buffer = Buffer.from(part.inlineData.data!, 'base64');
                    await fs.writeFile(filepath, buffer);

                    return `/uploads/${filename}`;
                }
            }

            return null;
        } catch (error: any) {
            console.error('AI image generation failed:', error.message);
            return null;
        }
    },

    /**
     * Extracts search keywords, then searches TheMealDB and Spoonacular for a matching dish image.
     */
    async _tryAIImageSearch(recipeTitle: string): Promise<string | null> {
        const keywords = this._extractKeywords(recipeTitle);

        for (const keyword of keywords) {
            try {
                const response = await axios.get(
                    `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(keyword)}`,
                    { timeout: 5000 }
                );
                const meals = response.data?.meals;
                if (meals?.length > 0 && meals[0].strMealThumb) {
                    return await this._downloadImageToUploads(meals[0].strMealThumb);
                }
            } catch {}
        }

        const spoonacularKey = process.env.SPOONACULAR_API_KEY;
        if (spoonacularKey) {
            for (const keyword of keywords) {
                try {
                    const response = await axios.get(
                        `https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(keyword)}&number=1&apiKey=${spoonacularKey}`,
                        { timeout: 5000 }
                    );
                    const results = response.data?.results;
                    if (results?.length > 0 && results[0].image) {
                        return await this._downloadImageToUploads(results[0].image);
                    }
                } catch {}
            }
        }

        return null;
    },

    _extractKeywords(recipeTitle: string): string[] {
        const stopWords = new Set(['a', 'an', 'the', 'with', 'and', 'or', 'in', 'on', 'of', 'for', 'to', 'my',
            'easy', 'simple', 'quick', 'best', 'classic', 'homemade', 'style', 'recipe']);
        const words = recipeTitle.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));
        if (words.length === 0) return [recipeTitle.toLowerCase()];
        if (words.length >= 2) return [words.slice(0, 2).join(' '), words[0], words[1]];
        return [words[0]];
    },

    /**
     * Checks multiple items for "running low" status in a single request.
     */
    async checkMultipleItemsIfRunningLow(items: { id: string; name: string; quantity: string }[], userCount: number): Promise<Map<string, boolean>> {
        if (items.length === 0) return new Map();

        const itemsList = items.map(item => `- ID: ${item.id}, Name: "${item.name}", Quantity: "${item.quantity}"`).join('\n');

        const prompt = `
You are a smart kitchen assistant. Determine if each of the following fridge items is running low for a household of ${userCount} people.

Context:
Household Size: ${userCount} person(s)

Items to evaluate:
${itemsList}

Task:
- Analyze if the quantity for each item is typically considered low/insufficient for this household size.
- Respond with ONLY a JSON array of objects.

Format:
[
  { "id": "item_id_here", "isRunningLow": true/false }
]
`;

        try {
            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
                config: {
                    temperature: 0.1,
                    maxOutputTokens: 4096,
                    responseMimeType: "application/json"
                }
            });

            const textContent = (response.text ?? '').trim();
            if (!textContent) throw new Error('No response from AI check');

            let cleaned = textContent;
            const cbMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (cbMatch) cleaned = cbMatch[1];
            const arrMatch = cleaned.match(/\[[\s\S]*\]/);
            if (arrMatch) {
                cleaned = arrMatch[0];
            } else if (cleaned.includes('[')) {
                cleaned = cleaned.substring(cleaned.indexOf('['));
                cleaned = cleaned.replace(/,?\s*\{[^}]*$/, '');
                cleaned = cleaned.replace(/,\s*$/, '');
                cleaned += ']';
            }
            cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

            const results = JSON.parse(cleaned);
            const statusMap = new Map<string, boolean>();

            if (Array.isArray(results)) {
                results.forEach((r: any) => {
                    if (r.id) statusMap.set(r.id, !!r.isRunningLow);
                });
            }

            return statusMap;
        } catch (error: any) {
            console.error('AI checkMultipleItemsIfRunningLow error:', error);
            return new Map();
        }
    },


    // Detects fridge items from a photo.
    async detectFridgeItems(imageBuffer: Buffer, mimeType: string): Promise<{ name: string; quantity: string }[]> {
        const base64Image = imageBuffer.toString('base64');

        const prompt = `You are a smart kitchen assistant. This photo is supposed to show the inside of a fridge, a pantry shelf, a countertop with groceries, or a set of food/grocery items that someone wants to log into their fridge inventory.

STEP 1 — Classify the image. Choose EXACTLY ONE value for "imageIssue":

"not_a_fridge" — the image does NOT clearly show a fridge interior, pantry shelf, countertop with groceries, or packaged/unpackaged food items. Use this for:
  • animals (cats, dogs, fish, sharks, birds, any wildlife or pet)
  • people, faces, selfies, body parts
  • landscapes, sky, outdoor scenes, buildings, vehicles
  • electronics, clothing, furniture, tools, documents
  • empty rooms, walls, floors
  • abstract images, screenshots, memes, drawings
  • cooked/plated meals on a restaurant table (this is a plate of food, not a fridge inventory)
  • anything that is not raw/packaged food items in a storage context

"too_blurry" — the image DOES show a fridge/shelf/food, but it is so out of focus or motion-blurred that individual items cannot be reliably identified.

"too_dark" — the image DOES show a fridge/shelf/food, but lighting is so poor that items cannot be seen.

null — the image clearly shows a fridge interior, a pantry/shelf, a countertop with groceries, or a group of food/grocery items that you can identify.

BE STRICT. If the subject is anything other than food-storage content (e.g. a shark, a sunset, a person), set imageIssue to "not_a_fridge" even if there happens to be a fridge in the background. When in doubt between null and "not_a_fridge", choose "not_a_fridge" — it's better to ask the user for a better photo than to hallucinate items.

STEP 2 — If and only if imageIssue is null, list every distinct food item you can identify. For each item give:
- "name": lowercase, singular where natural (e.g. "egg" not "eggs", "tomato" not "tomatoes")
- "quantity": short human-friendly string (e.g. "2", "1 bag", "500ml", "half a block")

If imageIssue is NOT null, "items" MUST be an empty array.
An empty "items" array with imageIssue = null is valid and means the fridge is genuinely empty of visible food.

Respond with ONLY a JSON object in this EXACT shape (no prose, no markdown):
{
  "imageIssue": null | "too_blurry" | "not_a_fridge" | "too_dark",
  "items": [
    { "name": "egg", "quantity": "6" },
    { "name": "milk", "quantity": "1 liter" }
  ]
}`;

        try {
            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType, data: base64Image } },
                            { text: prompt },
                        ],
                    },
                ],
                config: {
                    temperature: 0.2,
                    maxOutputTokens: 4096,
                    responseMimeType: "application/json",
                },
            });

            const textContent = response.text ?? '';
            if (!textContent) throw new ApiError(502, 'No response from AI');

            const parsed = parseScanResponse(textContent);

            if (parsed.imageIssue) {
                throw new ApiError(400, badImageMessage(parsed.imageIssue), 'BAD_SCAN_IMAGE');
            }

            return parsed.items
                .filter((item: any) => item && item.name && item.quantity)
                .map((item: any) => ({
                    name: String(item.name).trim(),
                    quantity: String(item.quantity).trim(),
                }));
        } catch (error: any) {
            if (error instanceof ApiError) throw error;
            if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate limit')) {
                throw new ApiError(429, 'AI rate limit exceeded. Please try again later.');
            }
            throw new ApiError(502, `AI scan service error: ${error.message}`);
        }
    },

    async checkIfRunningLow(itemName: string, quantity: string, userCount: number): Promise<{ isRunningLow: boolean; reasoning: string }> {
        const prompt = `
You are a smart kitchen assistant. Determine if the following fridge item is running low for a household of ${userCount} people.

Context:
- Item Name: "${itemName}"
- Current Quantity: "${quantity}"
- Household Size: ${userCount} person(s)

Task:
- Analyze if this quantity is typically considered low/insufficient for this household size.
- Respond with ONLY a JSON object.

Format:
{
  "isRunningLow": true/false, // Boolean
  "reasoning": "short explanation (max 15 words)"
}
`;

        try {
            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
                config: {
                    temperature: 0.1,
                    maxOutputTokens: 200,
                    responseMimeType: "application/json"
                }
            });

            const textContent = response.text;
            if (!textContent) throw new Error('No response from AI check');

            const result = JSON.parse(textContent);
            return {
                isRunningLow: !!result.isRunningLow,
                reasoning: result.reasoning || "AI assessment."
            };
        } catch (error: any) {
            console.error('AI checkRunningLow error:', error);
            // Default to false if AI fails
            return { isRunningLow: false, reasoning: "Could not determine status." };
        }
    }
};

function buildRecipePrompt(
    ingredients: string[],
    allergies: string[],
    dietPreference: string,
    count: number
): string {
    const ingredientCount = ingredients.length;

    let prompt = `You are a professional chef assistant for a fridge management app called FridgeMate.

## THE MOST IMPORTANT RULE — READ THIS FIRST
The user's fridge contains ONLY these items (with available quantities):
${ingredients.map(i => `- ${i}`).join('\n')}

You must ONLY use these fridge items plus basic pantry staples (defined below). Do NOT invent or add any perishable ingredient that is not listed above. This is the #1 rule and must never be violated.
HARD RULE: Every single recipe MUST use at least one fridge item listed above as a MAIN ingredient. If a recipe does not contain any fridge item, do NOT include it. If you cannot create any recipe that uses fridge items, return an empty array [].
Fridge items should be the star of the dish. Pantry staples (salt, oil, spices, etc.) are ONLY for supporting roles — seasoning, base, or binding.
Recipes must also respect the available quantities — do NOT suggest a recipe requiring more of an ingredient than the user has (e.g., if they have "Eggs (1)", do not create a recipe needing 3 eggs).

## What You CAN Add (Pantry Staples Only)
These non-perishable items can be assumed available: salt, black pepper, sugar, flour, cooking oil, olive oil, vinegar, soy sauce, dried spices and herbs (paprika, cumin, oregano, garlic powder, onion powder, cinnamon, chili flakes, red pepper flakes), baking powder, baking soda, vanilla extract, honey, mustard, hot sauce, water, rice, pasta, bread.

## What You CANNOT Add
NEVER add any of these if they are NOT in the fridge list above:
- Eggs, butter, milk, cream, yogurt, cheese, or any dairy
- Meat, poultry, fish, or seafood
- Fresh vegetables or fresh fruit (tomatoes, onions, lemons, limes, etc.)
- Tofu, tempeh, or other refrigerated proteins
- Any item that typically requires refrigeration

Example: if the fridge only has "Avocado (1)", do NOT add eggs, cheese, lime, tomato, chicken, or any fresh item. Only use that 1 avocado + pantry staples like salt, oil, spices, bread.

## Fewer Items = Fewer Recipes
If only ${count} recipes are requested but the available ingredients cannot realistically support ${count} distinct good recipes, return FEWER recipes rather than forcing bad ones. Quality over quantity. Return at least 1 recipe if any recipe is possible.`;

    if (allergies.length > 0) {
        prompt += `

## Allergies — CRITICAL SAFETY
The user has these allergies: ${allergies.join(', ')}
- NEVER include any of these allergens in any recipe, not even as optional or garnish.
- NEVER include ingredients that commonly contain or are derived from these allergens.
- If an allergen conflicts with a fridge item, skip that item entirely.`;
    }

    if (dietPreference !== 'NONE') {
        prompt += `

## Dietary Preference
The user follows a ${dietPreference} diet. ALL recipes must be strictly ${dietPreference.toLowerCase()}. Do not suggest any recipe that violates this.`;
    }

    prompt += `

## Recipe Quality Guidelines
- Generate up to ${count} recipes. Each should be a DIFFERENT type of dish (vary cuisines, cooking methods, and meal types — avoid variations of the same thing).
- Recipes must be practical and commonly known — no made-up or bizarre combinations.
- Cooking times and difficulty should be realistic.
- Nutrition estimates should be reasonable approximations for one serving.
- Steps should be concise and actionable (max 10 steps per recipe).
- Before outputting, double-check every ingredient: is it in the fridge list or the pantry staples list? If not, remove it.

## Response Format
Return ONLY a valid JSON array with 1 to ${count} objects. No markdown, no extra text.
Each object must match this structure exactly:
[
  {
    "title": "Recipe Name",
    "description": "One sentence description",
    "cookingTime": "30 minutes",
    "difficulty": "Easy",
    "ingredients": [{ "name": "ingredient", "amount": "amount" }],
    "steps": ["Step 1", "Step 2"],
    "nutrition": { "calories": "350 kcal", "protein": "25g", "carbs": "30g", "fat": "15g" }
  }
]

"difficulty" MUST be exactly one of: "Easy", "Medium", or "Hard".`;

    return prompt;
}

type ScanImageIssue = 'too_blurry' | 'not_a_fridge' | 'too_dark';

interface ScanAIResponse {
    imageIssue: ScanImageIssue | null;
    items: { name: string; quantity: string }[];
}

function badImageMessage(issue: ScanImageIssue): string {
    switch (issue) {
        case 'too_blurry':
            return 'The photo is too blurry to detect items. Please retake with a clearer shot.';
        case 'not_a_fridge':
            return "This doesn't look like a fridge or food. Please upload a photo of your fridge contents.";
        case 'too_dark':
            return 'The photo is too dark to detect items. Please retake with better lighting.';
    }
}

// Parses the AI scan response. Accepts the canonical { imageIssue, items } shape,
// but falls back to a raw JSON array for resilience (the model occasionally drops
// the wrapper object even when asked not to).
function parseScanResponse(text: string): ScanAIResponse {
    let cleaned = text.trim();

    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();

    let parsed: any;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        const objMatch = cleaned.match(/\{[\s\S]*\}/);
        const arrMatch = cleaned.match(/\[[\s\S]*\]/);
        const candidate = objMatch?.[0] ?? arrMatch?.[0];
        if (!candidate) throw new ApiError(502, 'AI did not return valid JSON');
        try {
            parsed = JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
        } catch {
            throw new ApiError(502, 'AI did not return valid JSON');
        }
    }

    if (Array.isArray(parsed)) {
        return { imageIssue: null, items: parsed };
    }

    if (parsed && typeof parsed === 'object') {
        const rawIssue = parsed.imageIssue;
        const imageIssue: ScanImageIssue | null =
            rawIssue === 'too_blurry' || rawIssue === 'not_a_fridge' || rawIssue === 'too_dark'
                ? rawIssue
                : null;
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        return { imageIssue, items };
    }

    throw new ApiError(502, 'AI returned an unexpected response shape');
}

function parseRecipeResponse(text: string): GeneratedRecipe[] {
    try {
        let cleanedText = text.trim();

        // Remove markdown code blocks (```json ... ``` or ``` ... ```)
        const codeBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            cleanedText = codeBlockMatch[1];
        }

        // Try to find JSON array in the response
        const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            cleanedText = jsonMatch[0];
        }

        cleanedText = cleanedText.trim();

        const recipes = JSON.parse(cleanedText);

        if (!Array.isArray(recipes)) {
            throw new ApiError(502, 'Response is not an array');
        }

        return recipes.map((recipe: any) => ({
            title: recipe.title || 'Untitled Recipe',
            description: recipe.description || '',
            cookingTime: recipe.cookingTime || recipe.cooking_time || 'Unknown',
            difficulty: recipe.difficulty || 'Medium',
            ingredients: recipe.ingredients || [],
            steps: recipe.steps || recipe.instructions || [],
            nutrition: recipe.nutrition || {}
        }));
    } catch (error) {
        console.error('Failed to parse AI response. Raw text:', text);
        console.error('Parse error:', error);
        throw new ApiError(502, 'Failed to parse recipe response from AI');
    }
}
