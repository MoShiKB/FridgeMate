import { Request, Response } from 'express';
import { AuthedRequest } from '../middlewares/auth';
import { AIService } from '../services/ai.service';
import { RecipeService } from '../services/recipe.service';
import { UserService } from '../services/user.service';

export const AIController = {
    async generateRecipes(req: Request, res: Response) {
        const userId = (req as AuthedRequest).user.userId;
        const { ingredients, count } = req.body;
        let { allergies, dietPreference } = req.body;

        const user = await UserService.getUserById(userId);
        if (user) {
            if (!allergies || allergies.length === 0) {
                allergies = user.allergies ?? [];
            }
            if (!dietPreference || dietPreference === 'NONE') {
                dietPreference = user.dietPreference ?? 'NONE';
            }
        }

        const result = await AIService.generateRecipes({
            ingredients,
            allergies,
            dietPreference,
            count,
        });

        const recipesWithImages = await Promise.all(
            result.recipes.map(async (recipe) => {
                const imageUrl = await AIService.generateRecipeImage(recipe.title);
                return { ...recipe, imageUrl };
            })
        );

        const saved = await RecipeService.bulkCreate(userId, recipesWithImages);

        const recipesResponse = saved.map((r) => ({
            _id: r._id,
            title: r.title,
            description: r.description,
            cookingTime: r.cookingTime,
            difficulty: r.difficulty,
            ingredients: r.ingredients,
            steps: r.steps,
            nutrition: r.nutrition,
            imageUrl: r.imageUrl,
        }));

        res.json({
            message: 'Recipes generated successfully',
            recipes: recipesResponse,
            count: recipesResponse.length
        });
    },

    async askAI(req: Request, res: Response) {
        const { query, recipe, recipeId, ingredients } = req.body;

        let recipeContext = recipe;
        if (recipeId && !recipe) {
            const savedRecipe = await RecipeService.getById(recipeId);
            if (!savedRecipe) {
                return res.status(404).json({ error: 'Recipe not found' });
            }
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
            ingredientsConsidered: availableIngredients.length
        });
    }
};
