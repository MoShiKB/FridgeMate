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

  firebaseUid?: string;

  email?: string;
  displayName: string;
  photoUrl?: string;

  
  userName?: string;


  role: UserRole;

  
  age?: number;
  address?: IAddress;

  allergies: string[];
  dietPreference: DietPreference;

  activeFridgeId?: mongoose.Types.ObjectId | null;

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
    
    firebaseUid: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
      trim: true,
    },

    
    email: {
      type: String,
      index: true,
      unique: true,
      sparse: true, 
      trim: true,
      lowercase: true,
    },

    displayName: { type: String, required: true, trim: true },
    photoUrl: { type: String, trim: true },


    userName: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },


    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      required: true,
    },


    age: { type: Number, min: 0 },
    address: { type: AddressSchema },

    allergies: { type: [String], default: [] },
    dietPreference: {
      type: String,
      enum: ["NONE", "VEGETARIAN", "VEGAN", "PESCATARIAN"],
      default: "NONE",
    },

    activeFridgeId: { type: Schema.Types.ObjectId, ref: "Fridge", default: null },
  },
  { timestamps: true }
);


UserSchema.index({ "address.city": 1 });


UserSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});


export const UserModel: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
export default UserModel;
