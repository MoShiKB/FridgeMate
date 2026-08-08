import mongoose, { Schema, Model } from "mongoose";

/**
 * Bump when the AI prompt or the meaning of any field changes, so stale rows
 * are ignored and refetched instead of having to clear the collection.
 */
export const CONSUMPTION_PROFILE_VERSION = 1;

export interface IConsumptionProfile {
  /** Normalized item name, e.g. "almond milk". */
  key: string;
  version: number;
  pieceServings: number;
  packageServings: number;
  gramsPerServing: number;
  mlPerServing: number;
  servingsPerPersonPerWeek: number;
  createdAt: Date;
  updatedAt: Date;
}

const ConsumptionProfileSchema = new Schema<IConsumptionProfile>(
  {
    key: { type: String, required: true, unique: true, index: true },
    version: { type: Number, required: true, default: CONSUMPTION_PROFILE_VERSION },
    pieceServings: { type: Number, required: true },
    packageServings: { type: Number, required: true },
    gramsPerServing: { type: Number, required: true },
    mlPerServing: { type: Number, required: true },
    servingsPerPersonPerWeek: { type: Number, required: true },
  },
  { timestamps: true }
);

export const ConsumptionProfileModel: Model<IConsumptionProfile> =
  mongoose.models.ConsumptionProfile ||
  mongoose.model<IConsumptionProfile>("ConsumptionProfile", ConsumptionProfileSchema);

export default ConsumptionProfileModel;
