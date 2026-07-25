import { Types } from "mongoose";
import NotificationModel, { NotificationType } from "../models/notification.model";
import UserModel from "../models/user.model";
import { getFirebaseApp } from "../config/firebase";
import { io } from "../index";

const BANNER_COOLDOWN_MS = 30_000;
const bannerLastEmit = new Map<string, number>();

export class NotificationService {
    static async sendNotification({
        userId,
        type,
        title,
        message,
        metadata,
        skipPersist = false,
        skipPush = false,
        dedupeBy,
    }: {
        userId: string | Types.ObjectId;
        type: NotificationType;
        title: string;
        message: string;
        metadata?: any;
        skipPersist?: boolean;
        skipPush?: boolean;
        dedupeBy?: string[];
    }) {
        try {
            let notification: any;

            if (!skipPersist) {
                let bannerAllowed = true;
                if (dedupeBy && dedupeBy.length > 0 && metadata) {
                    const filter: any = { userId, type };
                    for (const key of dedupeBy) {
                        filter[`metadata.${key}`] = metadata[key];
                    }
                    notification = await NotificationModel.findOneAndUpdate(
                        filter,
                        {
                            $set: {
                                title,
                                message,
                                metadata,
                                isRead: false,
                                createdAt: new Date(),
                            },
                        },
                        { new: true, upsert: true, setDefaultsOnInsert: true }
                    );

                    const cooldownKey = `${userId}:${type}:${dedupeBy
                        .map((k) => metadata[k])
                        .join(":")}`;
                    const now = Date.now();
                    const last = bannerLastEmit.get(cooldownKey) ?? 0;
                    if (now - last < BANNER_COOLDOWN_MS) {
                        bannerAllowed = false;
                    } else {
                        bannerLastEmit.set(cooldownKey, now);
                    }
                } else {
                    notification = await NotificationModel.create({
                        userId,
                        type,
                        title,
                        message,
                        metadata,
                    });
                }

                io.to(userId.toString()).emit(
                    bannerAllowed ? "new_notification" : "notification_updated",
                    notification
                );
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

    static async removeNotification({
        userId,
        type,
        metadata,
        dedupeBy,
    }: {
        userId: string | Types.ObjectId;
        type: NotificationType;
        metadata: any;
        dedupeBy: string[];
    }) {
        try {
            const filter: any = { userId, type };
            for (const key of dedupeBy) {
                filter[`metadata.${key}`] = metadata[key];
            }
            const doc = await NotificationModel.findOneAndDelete(filter);
            if (doc) {
                io.to(userId.toString()).emit("notification_removed", {
                    id: String(doc._id),
                });
            }
            return doc;
        } catch (error) {
            console.error("Error removing notification:", error);
            throw error;
        }
    }
}
