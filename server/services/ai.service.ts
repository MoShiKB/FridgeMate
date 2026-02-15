import axios from 'axios';

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

        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not configured');
        }

        const prompt = buildRecipePrompt(ingredients, allergies, dietPreference, count);

        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192,
                    }
                },
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            const textContent = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!textContent) {
                throw new Error('No response from AI');
            }

            const recipes = parseRecipeResponse(textContent);
            
            return {
                recipes,
                rawResponse: textContent
            };
        } catch (error: any) {
            if (error.response?.status === 429) {
                throw new Error('AI rate limit exceeded. Please try again later.');
            }
            throw new Error(`AI service error: ${error.message}`);
        }
    },

    async askAboutRecipe(query: string, recipe?: { title: string; ingredients?: any[]; steps?: string[] }, availableIngredients: string[] = []): Promise<string> {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not configured');
        }

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
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                    }
                },
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            const textContent = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            return textContent || 'Unable to process your request.';
        } catch (error: any) {
            if (error.response?.status === 429) {
                throw new Error('AI rate limit exceeded. Please try again later.');
            }
            throw new Error(`AI service error: ${error.message}`);
        }
    }
};

function buildRecipePrompt(
    ingredients: string[],
    allergies: string[],
    dietPreference: string,
    count: number
): string {
    let prompt = `You are a professional chef assistant. Generate exactly ${count} recipes based on the following ingredients: ${ingredients.join(', ')}.`;

    if (allergies.length > 0) {
        prompt += `\n\nIMPORTANT: The user has these allergies, NEVER include these ingredients: ${allergies.join(', ')}.`;
    }

    if (dietPreference !== 'NONE') {
        prompt += `\n\nDietary preference: ${dietPreference}. Only suggest ${dietPreference.toLowerCase()} recipes.`;
    }

    prompt += `

Return ONLY a valid JSON array with exactly ${count} recipes. Keep steps SHORT (max 10 steps per recipe). Format:
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

IMPORTANT: Return ONLY valid JSON, no markdown, no extra text. Ensure all strings are properly escaped.`;

    return prompt;
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
        
        console.log('Attempting to parse:', cleanedText.substring(0, 200) + '...');
        
        const recipes = JSON.parse(cleanedText);
        
        if (!Array.isArray(recipes)) {
            throw new Error('Response is not an array');
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
        throw new Error('Failed to parse recipe response from AI');
    }
}

