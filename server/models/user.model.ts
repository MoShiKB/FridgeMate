import mongoose, { Schema, Model } from "mongoose";

export type DietPreference = "NONE" | "VEGETARIAN" | "VEGAN" | "PESCATARIAN";
export type UserRole = "user" | "admin";

export interface IAddress {
  country?: string;
  city?: string;
  fullAddress?: string;
  lat?: number;
  lng?: number;
}

export interface IUser {
  userName?: string;
  email: string;
  password: string;

  displayName: string;
  profileImage?: string;

  role: UserRole;

  age?: number;
  address?: IAddress;

  allergies: string[];
  dietPreference: DietPreference;

  activeFridgeId?: mongoose.Types.ObjectId | null;

  refreshToken?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    country: { type: String, trim: true },
    city: { type: String, trim: true },
    fullAddress: { type: String, trim: true },
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, index: true, unique: true, lowercase: true, trim: true },
    userName: { type: String, index: true, unique: true, sparse: true, lowercase: true, trim: true },

    password: { type: String, required: true, select: false },

    displayName: { type: String, required: true, trim: true },
    profileImage: { type: String, trim: true },

    role: { type: String, enum: ["user", "admin"], default: "user", required: true },

    age: { type: Number, min: 0 },
    address: { type: AddressSchema },

    allergies: { type: [String], default: [] },
    dietPreference: { type: String, enum: ["NONE", "VEGETARIAN", "VEGAN", "PESCATARIAN"], default: "NONE" },

    activeFridgeId: { type: Schema.Types.ObjectId, ref: "Fridge", default: null },

    refreshToken: { type: String, select: false, default: null },
  },
  { timestamps: true }
);

UserSchema.index({ "address.city": 1 });

UserSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    delete ret.refreshToken;
    return ret;
  },
});

export const UserModel: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
export default UserModel;
