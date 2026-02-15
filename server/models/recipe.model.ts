import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IRecipeIngredient {
    name: string;
    amount: string;
}

export interface IRecipeNutrition {
    calories?: string;
    protein?: string;
    carbs?: string;
    fat?: string;
}

export interface IRecipe extends Document {
    userId: Types.ObjectId;
    title: string;
    description: string;
    cookingTime: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    ingredients: IRecipeIngredient[];
    steps: string[];
    nutrition?: IRecipeNutrition;

    createdAt: Date;
    updatedAt: Date;
}

const RecipeIngredientSchema = new Schema<IRecipeIngredient>(
    {
        name: { type: String, required: true },
        amount: { type: String, required: true },
    },
    { _id: false }
);

const RecipeNutritionSchema = new Schema<IRecipeNutrition>(
    {
        calories: { type: String },
        protein: { type: String },
        carbs: { type: String },
        fat: { type: String },
    },
    { _id: false }
);

const RecipeSchema = new Schema<IRecipe>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        title: {
            type: String,
            required: [true, 'Recipe title is required'],
        },
        description: {
            type: String,
            default: '',
        },
        cookingTime: {
            type: String,
            default: 'Unknown',
        },
        difficulty: {
            type: String,
            enum: ['Easy', 'Medium', 'Hard'],
            default: 'Medium',
        },
        ingredients: {
            type: [RecipeIngredientSchema],
            default: [],
        },
        steps: {
            type: [String],
            default: [],
        },
        nutrition: {
            type: RecipeNutritionSchema,
            default: {},
        },

    },
    {
        timestamps: true,
    }
);

const Recipe: Model<IRecipe> = mongoose.models.Recipe || mongoose.model<IRecipe>('Recipe', RecipeSchema);

export default Recipe;

