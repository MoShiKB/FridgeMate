import mongoose, { Schema } from "mongoose";

export interface IPostLocation {
  lat: number;
  lng: number;
  placeName?: string;
}

export interface IPost {
  authorUserId: mongoose.Types.ObjectId;
  title: string;
  text: string;
  mediaUrls: string[];
  likes: mongoose.Types.ObjectId[];
  recipeId?: mongoose.Types.ObjectId | null;
  location?: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
    placeName?: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    authorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    mediaUrls: { type: [String], default: [] },
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    recipeId: { type: Schema.Types.ObjectId, ref: "Recipe", default: null },
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number], // [lng, lat]
      },
      placeName: { type: String },
    },
  },
  { timestamps: true }
);

PostSchema.index({ location: "2dsphere" });

export const PostModel = mongoose.model<IPost>("Post", PostSchema);
