import { Request, Response } from 'express';
import axios from 'axios';
import { AuthedRequest } from '../middlewares/auth';
import { AIService } from '../services/ai.service';
import { RecipeService } from '../services/recipe.service';
import { UserService } from '../services/user.service';
import { ApiError } from '../utils/errors';

interface MealDBMeal {
    idMeal: string;
    strMeal: string;
    strMealThumb: string;
    strCategory?: string;
    strInstructions?: string;
    [key: string]: any;
}

async function getRecipesFromMealDB(ingredients: string[]): Promise<any[]> {
    const seen = new Set<string>();
    const results: any[] = [];

    for (const ingredient of ingredients.slice(0, 3)) {
        try {
            const filterRes = await axios.get(
                `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ingredient)}`,
                { timeout: 5000 }
            );
            const meals: MealDBMeal[] = filterRes.data?.meals || [];
            for (const meal of meals.slice(0, 3)) {
                if (seen.has(meal.idMeal)) continue;
                seen.add(meal.idMeal);

                try {
                    const detailRes = await axios.get(
                        `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`,
                        { timeout: 5000 }
                    );
                    const detail: MealDBMeal = detailRes.data?.meals?.[0];
                    if (!detail) continue;

                    const recipeIngredients: { name: string; amount: string }[] = [];
                    for (let i = 1; i <= 20; i++) {
                        const name = detail[`strIngredient${i}`]?.trim();
                        const measure = detail[`strMeasure${i}`]?.trim();
                        if (name) recipeIngredients.push({ name, amount: measure || '' });
                    }

                    const steps = (detail.strInstructions || '')
                        .split(/\r?\n/)
                        .map((s: string) => s.trim())
                        .filter((s: string) => s.length > 10)
                        .slice(0, 10);

                    results.push({
                        title: detail.strMeal,
                        description: `A delicious ${detail.strCategory || ''} dish.`.trim(),
                        cookingTime: '30 min',
                        difficulty: 'Medium',
                        ingredients: recipeIngredients,
                        steps,
                        nutrition: {},
                        imageUrl: detail.strMealThumb || null,
                    });

                    if (results.length >= 5) return results;
                } catch { /* skip this meal */ }
            }
        } catch { /* skip this ingredient */ }
    }

    return results;
}

export const AIController = {
    async generateRecipes(req: Request, res: Response) {
        const userId = (req as AuthedRequest).user.userId;
        const { ingredients, count } = req.body;
        let { allergies, dietPreference } = req.body;

        const user = await UserService.getUserById(userId);
        if (user) {
            if (!allergies || allergies.length === 0) allergies = user.allergies ?? [];
            if (!dietPreference || dietPreference === 'NONE') dietPreference = user.dietPreference ?? 'NONE';
        }

        let recipesWithImages: any[];

        try {
            const result = await AIService.generateRecipes({ ingredients, allergies, dietPreference, count });

            recipesWithImages = await Promise.all(
                result.recipes.map(async (recipe) => {
                    const imageUrl = await AIService.generateRecipeImage(recipe.title);
                    return { ...recipe, imageUrl };
                })
            );
        } catch (err: any) {
            if (err instanceof ApiError && err.status === 429) {
                // AI quota exceeded — fall back to TheMealDB
                recipesWithImages = await getRecipesFromMealDB(ingredients);

                if (recipesWithImages.length === 0) {
                    return res.status(503).json({ error: 'AI is unavailable and no fallback recipes found. Please try again later.' });
                }

                const saved = await RecipeService.bulkCreate(userId, recipesWithImages);
                return res.json({
                    message: 'Recipes from recipe database',
                    recipes: saved.map((r) => ({
                        _id: r._id,
                        title: r.title,
                        description: r.description,
                        cookingTime: r.cookingTime,
                        difficulty: r.difficulty,
                        ingredients: r.ingredients,
                        steps: r.steps,
                        nutrition: r.nutrition,
                        imageUrl: r.imageUrl,
                    })),
                    count: saved.length,
                });
            }
            throw err;
        }

        const saved = await RecipeService.bulkCreate(userId, recipesWithImages);
        res.json({
            message: 'Recipes generated successfully',
            recipes: saved.map((r) => ({
                _id: r._id,
                title: r.title,
                description: r.description,
                cookingTime: r.cookingTime,
                difficulty: r.difficulty,
                ingredients: r.ingredients,
                steps: r.steps,
                nutrition: r.nutrition,
                imageUrl: r.imageUrl,
            })),
            count: saved.length,
        });
    },

    async askAI(req: Request, res: Response) {
        const { query, recipe, recipeId, ingredients } = req.body;

        let recipeContext = recipe;
        if (recipeId && !recipe) {
            const savedRecipe = await RecipeService.getById(recipeId);
            if (!savedRecipe) return res.status(404).json({ error: 'Recipe not found' });
            recipeContext = {
                title: savedRecipe.title,
                ingredients: savedRecipe.ingredients,
                steps: savedRecipe.steps,
            };
        }

        const availableIngredients = ingredients || [];
        const answer = await AIService.askAboutRecipe(query, recipeContext, availableIngredients);

        res.json({
            query,
            answer,
            recipeContext: recipeContext?.title || null,
            ingredientsConsidered: availableIngredients.length,
        });
    },
};
