import mongoose, { Schema, Model } from "mongoose";

// Types
export type ItemOwnership = "SHARED" | "PRIVATE";

// Interface
export interface IInventoryItem {
  fridgeId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  name: string;
  quantity: string;
  ownership: ItemOwnership;
  isRunningLow: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Schema
const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    fridgeId: {
      type: Schema.Types.ObjectId,
      ref: "Fridge",
      required: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: String,
      required: true,
      trim: true,
    },
    ownership: {
      type: String,
      enum: ["SHARED", "PRIVATE"],
      required: true,
      default: "PRIVATE",
    },
    isRunningLow: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Transform _id to id in JSON responses
InventoryItemSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Model
export const InventoryItemModel: Model<IInventoryItem> =
  mongoose.models.InventoryItem ||
  mongoose.model<IInventoryItem>("InventoryItem", InventoryItemSchema);

export default InventoryItemModel;
