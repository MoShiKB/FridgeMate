import mongoose, { Schema, Model } from "mongoose";

export interface IDetectedItem {
  name: string;
  quantity: string;
}

export interface IScan {
  fridgeId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  status: "completed" | "failed";
  detectedItems: IDetectedItem[];
  addedItemIds: mongoose.Types.ObjectId[];
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DetectedItemSchema = new Schema<IDetectedItem>(
  {
    name: { type: String, required: true },
    quantity: { type: String, required: true },
  },
  { _id: false }
);

const ScanSchema = new Schema<IScan>(
  {
    fridgeId: {
      type: Schema.Types.ObjectId,
      ref: "Fridge",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["completed", "failed"],
      required: true,
    },
    detectedItems: { type: [DetectedItemSchema], default: [] },
    addedItemIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "InventoryItem" }],
      default: [],
    },
    error: { type: String },
  },
  { timestamps: true }
);

ScanSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const ScanModel: Model<IScan> =
  mongoose.models.Scan || mongoose.model<IScan>("Scan", ScanSchema);
