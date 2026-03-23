import mongoose from 'mongoose';
import Recipe, { IRecipe } from '../models/recipe.model';

interface RecipeData {
    title: string;
    description?: string;
    cookingTime?: string;
    difficulty?: 'Easy' | 'Medium' | 'Hard';
    ingredients?: { name: string; amount: string }[];
    steps?: string[];
    nutrition?: {
        calories?: string;
        protein?: string;
        carbs?: string;
        fat?: string;
    };
    imageUrl?: string | null;
}

export const RecipeService = {
    async bulkCreate(userId: string, recipes: RecipeData[]): Promise<IRecipe[]> {
        const uid = new mongoose.Types.ObjectId(userId);
        const docs = recipes.map((r) => ({
            createdBy: uid,
            favoritedBy: [],
            ...r,
        }));
        return Recipe.insertMany(docs) as unknown as IRecipe[];
    },

    async addToFavorites(recipeId: string, userId: string): Promise<IRecipe | null> {
        return Recipe.findByIdAndUpdate(
            recipeId,
            { $addToSet: { favoritedBy: new mongoose.Types.ObjectId(userId) } },
            { new: true }
        );
    },

    async removeFromFavorites(recipeId: string, userId: string): Promise<IRecipe | null> {
        return Recipe.findByIdAndUpdate(
            recipeId,
            { $pull: { favoritedBy: new mongoose.Types.ObjectId(userId) } },
            { new: true }
        );
    },

    async getById(recipeId: string): Promise<IRecipe | null> {
        return Recipe.findById(recipeId);
    },

    async getUserFavorites(
        userId: string,
        options: { page?: number; limit?: number } = {}
    ): Promise<{ recipes: IRecipe[]; total: number; page: number; limit: number }> {
        const { page = 1, limit = 20 } = options;
        const uid = new mongoose.Types.ObjectId(userId);

        const [recipes, total] = await Promise.all([
            Recipe.find({ favoritedBy: uid })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Recipe.countDocuments({ favoritedBy: uid }),
        ]);

        return { recipes, total, page, limit };
    },

    async isFavoritedByUser(recipeId: string, userId: string): Promise<boolean> {
        const uid = new mongoose.Types.ObjectId(userId);
        const recipe = await Recipe.findOne({ _id: recipeId, favoritedBy: uid });
        return !!recipe;
    },
};
