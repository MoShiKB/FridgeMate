import mongoose, { Schema } from "mongoose";

export interface IFridgeMember {
  userId: mongoose.Types.ObjectId;
  joinedAt: Date;
}

export interface IFridge {
  name: string;
  inviteCode: string;
  members: IFridgeMember[];
  createdAt: Date;
  updatedAt: Date;
}

const FridgeMemberSchema = new Schema<IFridgeMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const FridgeSchema = new Schema<IFridge>(
  {
    name: { type: String, required: true, trim: true },
    inviteCode: { type: String, required: true, unique: true, index: true },
    members: { type: [FridgeMemberSchema], default: [] },
  },
  { timestamps: true }
);

export const FridgeModel = mongoose.model<IFridge>("Fridge", FridgeSchema);
