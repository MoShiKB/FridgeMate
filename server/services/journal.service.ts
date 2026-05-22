import mongoose from "mongoose";
import { ApiError } from "../utils/errors";
import { JournalModel, IJournalEntry } from "../models/journal.model";

export class JournalService {
  static async create(userId: string, payload: any): Promise<IJournalEntry> {
    const entryDate = payload.date ? new Date(payload.date) : new Date();
    
    const meals = (payload.meals || []).map((m: any) => ({
      mealType: m.mealType,
      recipeId: m.recipeId ? new mongoose.Types.ObjectId(m.recipeId) : null,
      customRecipeTitle: m.customRecipeTitle || null,
      calories: m.calories || null,
      notes: m.notes || null,
    }));

    const entry = await JournalModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      title: payload.title,
      content: payload.content || '',
      date: entryDate,
      meals,
      rating: payload.rating || null,
      mood: payload.mood || null,
      imageUrl: payload.imageUrl || null,
    });

    return entry;
  }

  static async list(
    userId: string,
    opts: {
      skip: number;
      limit: number;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const q: any = { userId: new mongoose.Types.ObjectId(userId) };

    if (opts.startDate || opts.endDate) {
      q.date = {};
      if (opts.startDate) {
        q.date.$gte = new Date(opts.startDate);
      }
      if (opts.endDate) {
        q.date.$lte = new Date(opts.endDate);
      }
    }

    const [items, total] = await Promise.all([
      JournalModel.find(q)
        .populate({
          path: "meals.recipeId",
          select: "title description cookingTime difficulty imageUrl nutrition",
        })
        .sort({ date: -1, createdAt: -1 })
        .skip(opts.skip)
        .limit(opts.limit)
        .exec(),
      JournalModel.countDocuments(q),
    ]);

    return {
      items,
      total,
    };
  }

  static async getById(userId: string, id: string): Promise<IJournalEntry> {
    const entry = await JournalModel.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(userId),
    })
      .populate({
        path: "meals.recipeId",
        select: "title description cookingTime difficulty imageUrl nutrition",
      })
      .exec();

    if (!entry) {
      throw new ApiError(404, "Journal entry not found", "JOURNAL_ENTRY_NOT_FOUND");
    }

    return entry;
  }

  static async update(userId: string, id: string, patch: any): Promise<IJournalEntry> {
    const entry = await JournalModel.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!entry) {
      throw new ApiError(404, "Journal entry not found", "JOURNAL_ENTRY_NOT_FOUND");
    }

    if (patch.title !== undefined) entry.title = patch.title;
    if (patch.content !== undefined) entry.content = patch.content;
    if (patch.date !== undefined) entry.date = new Date(patch.date);
    if (patch.rating !== undefined) entry.rating = patch.rating;
    if (patch.mood !== undefined) entry.mood = patch.mood;
    if (patch.imageUrl !== undefined) entry.imageUrl = patch.imageUrl;

    if (patch.meals !== undefined) {
      entry.meals = patch.meals.map((m: any) => ({
        mealType: m.mealType,
        recipeId: m.recipeId ? new mongoose.Types.ObjectId(m.recipeId) : null,
        customRecipeTitle: m.customRecipeTitle || null,
        calories: m.calories || null,
        notes: m.notes || null,
      }));
    }

    await entry.save();
    
    const populated = await JournalModel.findById(entry._id)
      .populate({
        path: "meals.recipeId",
        select: "title description cookingTime difficulty imageUrl nutrition",
      })
      .exec();
      
    if (!populated) throw new ApiError(500, "Failed to retrieve updated entry");
    return populated;
  }

  static async remove(userId: string, id: string) {
    const entry = await JournalModel.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!entry) {
      throw new ApiError(404, "Journal entry not found", "JOURNAL_ENTRY_NOT_FOUND");
    }

    await entry.deleteOne();
    return { ok: true };
  }
}
