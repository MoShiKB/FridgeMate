import mongoose, { Schema, Model } from "mongoose";

export type NotificationType = "EXPIRING_ITEM" | "CHAT_MESSAGE" | "FRIDGE_INVITE" | "POST_COMMENT" | "POST_LIKE" | "FOLLOW" | "SCAN_COMPLETE" | "SYSTEM";

export interface INotification {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { 
        type: String, 
        enum: ["EXPIRING_ITEM", "CHAT_MESSAGE", "FRIDGE_INVITE", "POST_COMMENT", "POST_LIKE", "FOLLOW", "SCAN_COMPLETE", "SYSTEM"], 
        required: true 
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

NotificationSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const NotificationModel: Model<INotification> = mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);
export default NotificationModel;
