import mongoose, { Schema } from "mongoose";

export interface IComment {
  postId: mongoose.Types.ObjectId;
  authorUserId: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    authorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const CommentModel = mongoose.model<IComment>("Comment", CommentSchema);
