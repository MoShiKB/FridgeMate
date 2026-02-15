import { Request, Response, NextFunction } from 'express';
import { RecipeService } from '../services/recipe.service';

export const RecipeController = {
    async saveToFavorites(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.body.userId; // From auth middleware
            const { title, description, cookingTime, difficulty, ingredients, steps, nutrition } = req.body;

            if (!title) {
                return res.status(400).json({ error: 'Recipe title is required' });
            }

            const isDuplicate = await RecipeService.isDuplicate(userId, title);
            if (isDuplicate) {
                return res.status(409).json({ error: 'Recipe already saved to favorites' });
            }

            const recipe = await RecipeService.saveToFavorites(userId, {
                title,
                description,
                cookingTime,
                difficulty,
                ingredients,
                steps,
                nutrition,
            });

            res.status(201).json({
                message: 'Recipe saved to favorites',
                recipe,
            });
        } catch (err: any) {
            next(err);
        }
    },

    async getUserRecipes(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.body.userId;
            const page = parseInt(req.query.page as string) || 1;
            const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

            const result = await RecipeService.getUserRecipes(userId, {
                page,
                limit,
            });

            res.json({
                items: result.recipes,
                total: result.total,
                page: result.page,
                limit: result.limit,
            });
        } catch (err: any) {
            next(err);
        }
    },

    async getRecipeById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;

            const recipe = await RecipeService.getById(id);
            if (!recipe) {
                return res.status(404).json({ error: 'Recipe not found' });
            }

            res.json(recipe);
        } catch (err: any) {
            next(err);
        }
    },

    async deleteFromFavorites(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.body.userId;
            const { id } = req.params;

            const deleted = await RecipeService.deleteFromFavorites(id, userId);
            if (!deleted) {
                return res.status(404).json({ error: 'Recipe not found or not owned by user' });
            }

            res.json({ message: 'Recipe removed from favorites' });
        } catch (err: any) {
            next(err);
        }
    },

    async getRecipesByUserId(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            const page = parseInt(req.query.page as string) || 1;
            const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

            const result = await RecipeService.getRecipesByUserId(userId, { page, limit });

            res.json({
                items: result.recipes,
                total: result.total,
                page: result.page,
                limit: result.limit,
            });
        } catch (err: any) {
            next(err);
        }
    },
};

