import mongoose, { Schema, Model, Types } from "mongoose";

export type FridgeChatMessageType = "text" | "recipe_share";

export interface IFridgeChatMessage {
  _id: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  type: FridgeChatMessageType;
  payload?: Record<string, unknown>;
  createdAt: Date;
}

export interface IFridgeChat {
  fridgeId: Types.ObjectId;
  messages: IFridgeChatMessage[];
  lastMessage: string;
  lastUpdated: Date;
}

const FridgeChatMessageSchema = new Schema<IFridgeChatMessage>(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    type: {
      type: String,
      enum: ["text", "recipe_share"],
      default: "text",
      required: true,
    },
    payload: { type: Schema.Types.Mixed, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const FridgeChatSchema = new Schema<IFridgeChat>(
  {
    fridgeId: {
      type: Schema.Types.ObjectId,
      ref: "Fridge",
      required: true,
      unique: true,
      index: true,
    },
    messages: { type: [FridgeChatMessageSchema], default: [] },
    lastMessage: { type: String, default: "" },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const FridgeChatModel: Model<IFridgeChat> =
  mongoose.models.FridgeChat || mongoose.model<IFridgeChat>("FridgeChat", FridgeChatSchema);

export default FridgeChatModel;
