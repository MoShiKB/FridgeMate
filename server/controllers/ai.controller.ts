import { Request, Response, NextFunction } from 'express';
import { AIService } from '../services/ai.service';
import { RecipeService } from '../services/recipe.service';

export const AIController = {
    async generateRecipes(req: Request, res: Response, next: NextFunction) {
        try {
            const { ingredients, allergies, dietPreference, count } = req.body;

            if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
                return res.status(400).json({
                    error: 'ingredients is required and must be a non-empty array'
                });
            }

            const result = await AIService.generateRecipes({
                ingredients,
                allergies,
                dietPreference,
                count: count || 3
            });

            res.json({
                message: 'Recipes generated successfully',
                recipes: result.recipes,
                count: result.recipes.length
            });
        } catch (err: any) {
            next(err);
        }
    },

    async askAI(req: Request, res: Response, next: NextFunction) {
        try {
            const { query, recipe, recipeId, ingredients } = req.body;

            if (!query || typeof query !== 'string') {
                return res.status(400).json({
                    error: 'query is required and must be a string'
                });
            }

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
        } catch (err: any) {
            next(err);
        }
    }
};

