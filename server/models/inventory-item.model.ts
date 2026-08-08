import mongoose, { Schema, Model } from "mongoose";

// Types
export type ItemOwnership = "SHARED" | "PRIVATE";

// Interface
export interface IInventoryItem {
  fridgeId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId | null;
  name: string;
  quantity: string;
  category?: string;
  ownership: ItemOwnership;
  isRunningLow: boolean;
  /** Estimated days the remaining quantity lasts the household. */
  daysOfSupply: number | null;
  /** How much to buy to get back to a full stock, e.g. "3 cartons". */
  suggestedRestockQuantity: string | null;
  lowStockReason: string | null;
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
      required: false,
      default: null,
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
    category: {
      type: String,
      required: false,
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
    daysOfSupply: {
      type: Number,
      default: null,
    },
    suggestedRestockQuantity: {
      type: String,
      default: null,
    },
    lowStockReason: {
      type: String,
      default: null,
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
