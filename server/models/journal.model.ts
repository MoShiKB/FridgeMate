import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IJournalMeal {
    mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
    recipeId?: Types.ObjectId;
    customRecipeTitle?: string;
    calories?: number;
    notes?: string;
}

export interface IJournalEntry extends Document {
    userId: Types.ObjectId;
    title: string;
    content?: string;
    date: Date;
    meals: IJournalMeal[];
    rating?: number;
    mood?: string;
    imageUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

const JournalMealSchema = new Schema<IJournalMeal>(
    {
        mealType: {
            type: String,
            enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'],
            required: true,
        },
        recipeId: {
            type: Schema.Types.ObjectId,
            ref: 'Recipe',
            default: null,
        },
        customRecipeTitle: {
            type: String,
            trim: true,
            default: null,
        },
        calories: {
            type: Number,
            default: null,
        },
        notes: {
            type: String,
            trim: true,
            default: null,
        },
    },
    { _id: false }
);

const JournalSchema = new Schema<IJournalEntry>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        title: {
            type: String,
            required: [true, 'Journal entry title is required'],
            trim: true,
        },
        content: {
            type: String,
            trim: true,
            default: '',
        },
        date: {
            type: Date,
            required: [true, 'Journal entry date is required'],
            default: Date.now,
        },
        meals: {
            type: [JournalMealSchema],
            default: [],
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: null,
        },
        mood: {
            type: String,
            trim: true,
            default: null,
        },
        imageUrl: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Transform _id to id in JSON responses
JournalSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const JournalModel: Model<IJournalEntry> =
    mongoose.models.Journal || mongoose.model<IJournalEntry>('Journal', JournalSchema);

export default JournalModel;
