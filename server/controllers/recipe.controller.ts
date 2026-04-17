import { Request, Response } from 'express';
import { AuthedRequest } from '../middlewares/auth';
import { RecipeService } from '../services/recipe.service';

export const RecipeController = {
    async addToFavorites(req: Request, res: Response) {
        const userId = (req as AuthedRequest).user.userId;
        const { id } = req.params;

        const already = await RecipeService.isFavoritedByUser(id, userId);
        if (already) {
            return res.status(409).json({ error: 'Recipe already in favorites' });
        }

        const recipe = await RecipeService.addToFavorites(id, userId);
        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        res.json({ message: 'Recipe added to favorites', recipe });
    },

    async removeFromFavorites(req: Request, res: Response) {
        const userId = (req as AuthedRequest).user.userId;
        const { id } = req.params;

        const recipe = await RecipeService.removeFromFavorites(id, userId);
        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        res.json({ message: 'Recipe removed from favorites' });
    },

    async getUserFavorites(req: Request, res: Response) {
        const userId = (req as AuthedRequest).user.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

        const result = await RecipeService.getUserFavorites(userId, { page, limit });

        res.json({
            items: result.recipes,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    },

    async getRecipeById(req: Request, res: Response) {
        const { id } = req.params;
        const userId = (req as AuthedRequest).user.userId;

        const recipe = await RecipeService.getById(id);
        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        const obj = recipe.toObject();
        const isFavorited = userId
            ? (obj.favoritedBy || []).some((uid: any) => uid.toString() === userId)
            : false;

        res.json({ ...obj, isFavorited });
    },
};
