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
}

export const RecipeService = {
    async saveToFavorites(userId: string, recipeData: RecipeData): Promise<IRecipe> {
        const recipe = new Recipe({
            userId,
            ...recipeData,
        });
        return recipe.save();
    },

    async getById(recipeId: string): Promise<IRecipe | null> {
        return Recipe.findById(recipeId);
    },

    async getByIdAndUser(recipeId: string, userId: string): Promise<IRecipe | null> {
        return Recipe.findOne({ _id: recipeId, userId });
    },

    async getUserRecipes(
        userId: string,
        options: {
            page?: number;
            limit?: number;
        } = {}
    ): Promise<{ recipes: IRecipe[]; total: number; page: number; limit: number }> {
        const { page = 1, limit = 20 } = options;

        const [recipes, total] = await Promise.all([
            Recipe.find({ userId })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Recipe.countDocuments({ userId }),
        ]);

        return { recipes, total, page, limit };
    },

    async deleteFromFavorites(recipeId: string, userId: string): Promise<IRecipe | null> {
        return Recipe.findOneAndDelete({ _id: recipeId, userId });
    },

    async isDuplicate(userId: string, title: string): Promise<boolean> {
        const existing = await Recipe.findOne({ userId, title });
        return !!existing;
    },

    async getRecipesByUserId(
        userId: string,
        options: { page?: number; limit?: number } = {}
    ): Promise<{ recipes: IRecipe[]; total: number; page: number; limit: number }> {
        const { page = 1, limit = 20 } = options;

        const [recipes, total] = await Promise.all([
            Recipe.find({ userId })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Recipe.countDocuments({ userId }),
        ]);

        return { recipes, total, page, limit };
    },
};

