import { Request, Response } from "express";
import NotificationModel from "../models/notification.model";
import UserModel from "../models/user.model";
import { AuthedRequest } from "../middlewares/auth";

export class NotificationController {
    static async getNotifications(req: Request, res: Response) {
        try {
            const userId = (req as AuthedRequest).user.userId;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;

            const notifications = await NotificationModel.find({ userId })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);

            const total = await NotificationModel.countDocuments({ userId });

            res.json({
                notifications,
                page,
                totalPages: Math.ceil(total / limit),
                total
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch notifications" });
        }
    }

    static async getUnreadCount(req: Request, res: Response) {
        try {
            const userId = (req as AuthedRequest).user.userId;
            const count = await NotificationModel.countDocuments({ userId, isRead: false });
            res.json({ unreadCount: count });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch unread count" });
        }
    }

    static async markAsRead(req: Request, res: Response) {
        try {
            const userId = (req as AuthedRequest).user.userId;
            const notificationId = req.params.id;

            const notification = await NotificationModel.findOneAndUpdate(
                { _id: notificationId, userId },
                { isRead: true },
                { new: true }
            );

            if (!notification) {
                return res.status(404).json({ error: "Notification not found" });
            }

            res.json({ notification });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to mark as read" });
        }
    }

    static async markAllAsRead(req: Request, res: Response) {
        try {
            const userId = (req as AuthedRequest).user.userId;

            await NotificationModel.updateMany(
                { userId, isRead: false },
                { isRead: true }
            );

            res.json({ message: "All notifications marked as read" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to mark all as read" });
        }
    }

    static async registerFcmToken(req: Request, res: Response) {
        try {
            const userId = (req as AuthedRequest).user.userId;
            const { token } = req.body;

            if (!token) {
                return res.status(400).json({ error: "FCM token is required" });
            }

            await UserModel.findByIdAndUpdate(userId, {
                $addToSet: { fcmTokens: token }
            });

            res.json({ message: "FCM token registered successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to register FCM token" });
        }
    }

    static async unregisterFcmToken(req: Request, res: Response) {
        try {
            const userId = (req as AuthedRequest).user.userId;
            const { token } = req.body;

            if (!token) {
                return res.status(400).json({ error: "FCM token is required" });
            }

            await UserModel.findByIdAndUpdate(userId, {
                $pull: { fcmTokens: token }
            });

            res.json({ message: "FCM token removed successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to remove FCM token" });
        }
    }
}
