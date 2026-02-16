import mongoose, { Schema, Model, Types } from "mongoose";

export interface IMessage {
    _id: Types.ObjectId;
    sender: Types.ObjectId;
    content: string;
    status: "sent" | "read";
    createdAt: Date;
}

export interface IChat {
    participants: Types.ObjectId[];
    messages: IMessage[];
    lastMessage?: string;
    lastUpdated: Date;
}

const MessageSchema = new Schema<IMessage>(
    {
        sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
        content: { type: String, required: true, trim: true },
        status: { type: String, enum: ["sent", "read"], default: "sent" },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

const ChatSchema = new Schema<IChat>(
    {
        participants: {
            type: [{ type: Schema.Types.ObjectId, ref: "User" }],
            validate: {
                validator: (v: Types.ObjectId[]) => v.length === 2,
                message: "A chat must have exactly 2 participants",
            },
            required: true,
        },
        messages: { type: [MessageSchema], default: [] },
        lastMessage: { type: String, default: "" },
        lastUpdated: { type: Date, default: Date.now },
    },
    { timestamps: false }
);

ChatSchema.index({ participants: 1 });

export const ChatModel: Model<IChat> =
    mongoose.models.Chat || mongoose.model<IChat>("Chat", ChatSchema);

export default ChatModel;
