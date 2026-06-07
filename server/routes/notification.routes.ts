import express from "express";
import { NotificationController } from "../controllers/notification.controller";
import { requireAuth } from "../middlewares/auth";

const router = express.Router();

router.use(requireAuth);

router.get("/", NotificationController.getNotifications);
router.get("/unread-count", NotificationController.getUnreadCount);
router.put("/read-all", NotificationController.markAllAsRead);
router.put("/:id/read", NotificationController.markAsRead);

router.post("/fcm-token", NotificationController.registerFcmToken);
router.delete("/fcm-token", NotificationController.unregisterFcmToken);

export default router;
