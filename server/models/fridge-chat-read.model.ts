import mongoose, { Schema, Model, Types } from "mongoose";

export interface IFridgeChatRead {
  fridgeId: Types.ObjectId;
  userId: Types.ObjectId;
  lastReadAt: Date;
}

const FridgeChatReadSchema = new Schema<IFridgeChatRead>(
  {
    fridgeId: { type: Schema.Types.ObjectId, ref: "Fridge", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastReadAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false }
);

FridgeChatReadSchema.index({ fridgeId: 1, userId: 1 }, { unique: true });

export const FridgeChatReadModel: Model<IFridgeChatRead> =
  mongoose.models.FridgeChatRead ||
  mongoose.model<IFridgeChatRead>("FridgeChatRead", FridgeChatReadSchema);

export default FridgeChatReadModel;
