import mongoose, { Schema } from "mongoose";

export interface IPostLocation {
  lat: number;
  lng: number;
  placeName?: string;
}

export interface IPost {
  authorUserId: mongoose.Types.ObjectId;
  text: string;
  mediaUrls: string[];
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
    text: { type: String, required: true, trim: true },
    mediaUrls: { type: [String], default: [] },
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
