import { Types } from "mongoose";
import NotificationModel, { NotificationType } from "../models/notification.model";
import UserModel from "../models/user.model";
import { getFirebaseApp } from "../config/firebase";
import { io } from "../index";

export class NotificationService {
    static async sendNotification({
        userId,
        type,
        title,
        message,
        metadata,
        skipPersist = false,
        skipPush = false,
    }: {
        userId: string | Types.ObjectId;
        type: NotificationType;
        title: string;
        message: string;
        metadata?: any;
        skipPersist?: boolean;
        skipPush?: boolean;
    }) {
        try {
            let notification: any;

            if (!skipPersist) {
                notification = await NotificationModel.create({
                    userId,
                    type,
                    title,
                    message,
                    metadata
                });

                io.to(userId.toString()).emit("new_notification", notification);
            }

            if (skipPush) {
                return notification;
            }

            const user = await UserModel.findById(userId).select("fcmTokens");
            if (user && user.fcmTokens && user.fcmTokens.length > 0) {
                const firebaseApp = getFirebaseApp();
                if (firebaseApp) {
                    const messaging = firebaseApp.messaging();
                    
                    const payload = {
                        notification: {
                            title,
                            body: message
                        },
                        data: {
                            type,
                            metadata: metadata ? JSON.stringify(metadata) : "",
                            notificationId: notification?._id ? notification._id.toString() : ""
                        },
                        tokens: user.fcmTokens
                    };

                    const response = await messaging.sendEachForMulticast(payload);

                    if (response.failureCount > 0) {
                        const failedTokens: string[] = [];
                        response.responses.forEach((resp, idx) => {
                            if (!resp.success) {
                                failedTokens.push(user.fcmTokens![idx]);
                            }
                        });

                        if (failedTokens.length > 0) {
                            await UserModel.findByIdAndUpdate(userId, {
                                $pullAll: { fcmTokens: failedTokens }
                            });
                        }
                    }
                }
            }

            return notification;
        } catch (error) {
            console.error("Error sending notification:", error);
            throw error;
        }
    }
}
