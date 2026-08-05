import request from "supertest";
import mongoose from "mongoose";
import app from "../../index";
import { token, userId } from "../setup";
import NotificationModel from "../../models/notification.model";
import UserModel from "../../models/user.model";

describe("Notification Routes", () => {
    describe("GET /notifications", () => {
        it("returns an empty page for a user with no notifications", async () => {
            const res = await request(app)
                .get("/notifications")
                .set("Authorization", token);
            expect(res.status).toBe(200);
            expect(res.body.notifications).toEqual([]);
            expect(res.body.total).toBe(0);
            expect(res.body.page).toBe(1);
            expect(res.body.totalPages).toBe(0);
        });

        it("returns notifications for the caller only, sorted newest first", async () => {
            const otherUserId = new mongoose.Types.ObjectId();
            await NotificationModel.create([
                { userId, type: "SYSTEM", title: "Older", message: "A", createdAt: new Date("2026-01-01") },
                { userId, type: "SYSTEM", title: "Newer", message: "B", createdAt: new Date("2026-06-01") },
                { userId: otherUserId, type: "SYSTEM", title: "Not mine", message: "C" },
            ]);

            const res = await request(app)
                .get("/notifications")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.notifications).toHaveLength(2);
            expect(res.body.notifications[0].title).toBe("Newer");
            expect(res.body.notifications[1].title).toBe("Older");
            expect(res.body.total).toBe(2);
        });

        it("respects the `page` and `limit` query params", async () => {
            const docs = Array.from({ length: 5 }).map((_, i) => ({
                userId,
                type: "SYSTEM" as const,
                title: `#${i}`,
                message: `msg-${i}`,
                createdAt: new Date(2026, 0, i + 1),
            }));
            await NotificationModel.create(docs);

            const res = await request(app)
                .get("/notifications?page=2&limit=2")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.notifications).toHaveLength(2);
            expect(res.body.page).toBe(2);
            expect(res.body.total).toBe(5);
            expect(res.body.totalPages).toBe(3);
        });

        it("requires authentication", async () => {
            const res = await request(app).get("/notifications");
            expect(res.status).toBe(401);
        });
    });

    describe("GET /notifications/unread-count", () => {
        it("returns 0 when the user has no notifications", async () => {
            const res = await request(app)
                .get("/notifications/unread-count")
                .set("Authorization", token);
            expect(res.status).toBe(200);
            expect(res.body.unreadCount).toBe(0);
        });

        it("counts only unread notifications for the caller", async () => {
            await NotificationModel.create([
                { userId, type: "SYSTEM", title: "a", message: "a", isRead: false },
                { userId, type: "SYSTEM", title: "b", message: "b", isRead: false },
                { userId, type: "SYSTEM", title: "c", message: "c", isRead: true },
                { userId: new mongoose.Types.ObjectId(), type: "SYSTEM", title: "d", message: "d", isRead: false },
            ]);

            const res = await request(app)
                .get("/notifications/unread-count")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.unreadCount).toBe(2);
        });
    });

    describe("PUT /notifications/:id/read", () => {
        it("marks a notification as read and returns it", async () => {
            const notif = await NotificationModel.create({
                userId,
                type: "SYSTEM",
                title: "hello",
                message: "world",
                isRead: false,
            });

            const res = await request(app)
                .put(`/notifications/${notif._id}/read`)
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.notification.isRead).toBe(true);

            const check = await NotificationModel.findById(notif._id);
            expect(check!.isRead).toBe(true);
        });

        it("returns 404 for a non-existent notification", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/notifications/${fakeId}/read`)
                .set("Authorization", token);
            expect(res.status).toBe(404);
        });

        it("does not let a user mark another user's notification as read", async () => {
            const notif = await NotificationModel.create({
                userId: new mongoose.Types.ObjectId(),
                type: "SYSTEM",
                title: "foreign",
                message: "x",
            });
            const res = await request(app)
                .put(`/notifications/${notif._id}/read`)
                .set("Authorization", token);
            expect(res.status).toBe(404);
        });

        it("returns 500 when the id is not a valid ObjectId (cast error)", async () => {
            const res = await request(app)
                .put(`/notifications/not-an-object-id/read`)
                .set("Authorization", token);
            expect(res.status).toBe(500);
        });
    });

    describe("PUT /notifications/read-all", () => {
        it("marks every unread notification for the user as read", async () => {
            const otherUserId = new mongoose.Types.ObjectId();
            await NotificationModel.create([
                { userId, type: "SYSTEM", title: "a", message: "a", isRead: false },
                { userId, type: "SYSTEM", title: "b", message: "b", isRead: false },
                { userId: otherUserId, type: "SYSTEM", title: "c", message: "c", isRead: false },
            ]);

            const res = await request(app)
                .put("/notifications/read-all")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/marked as read/i);

            const remainingUnread = await NotificationModel.countDocuments({
                userId,
                isRead: false,
            });
            expect(remainingUnread).toBe(0);

            const otherUnread = await NotificationModel.countDocuments({
                userId: otherUserId,
                isRead: false,
            });
            expect(otherUnread).toBe(1);
        });
    });

    describe("POST /notifications/fcm-token", () => {
        it("adds a token to the user's fcmTokens array (idempotent)", async () => {
            const res = await request(app)
                .post("/notifications/fcm-token")
                .set("Authorization", token)
                .send({ token: "device-token-1" });
            expect(res.status).toBe(200);

            const check1 = await UserModel.findById(userId);
            expect(check1!.fcmTokens).toEqual(["device-token-1"]);

            // second time - should not duplicate ($addToSet)
            const res2 = await request(app)
                .post("/notifications/fcm-token")
                .set("Authorization", token)
                .send({ token: "device-token-1" });
            expect(res2.status).toBe(200);

            const check2 = await UserModel.findById(userId);
            expect(check2!.fcmTokens).toEqual(["device-token-1"]);
        });

        it("returns 400 when no token is provided", async () => {
            const res = await request(app)
                .post("/notifications/fcm-token")
                .set("Authorization", token)
                .send({});
            expect(res.status).toBe(400);
        });
    });

    describe("DELETE /notifications/fcm-token", () => {
        it("removes a specific token from the user's array", async () => {
            await UserModel.findByIdAndUpdate(userId, {
                $set: { fcmTokens: ["a", "b", "c"] },
            });

            const res = await request(app)
                .delete("/notifications/fcm-token")
                .set("Authorization", token)
                .send({ token: "b" });
            expect(res.status).toBe(200);

            const check = await UserModel.findById(userId);
            expect(check!.fcmTokens).toEqual(["a", "c"]);
        });

        it("returns 400 when no token is provided", async () => {
            const res = await request(app)
                .delete("/notifications/fcm-token")
                .set("Authorization", token)
                .send({});
            expect(res.status).toBe(400);
        });
    });

    describe("POST /notifications/test", () => {
        it("triggers a SYSTEM notification for the caller and persists it", async () => {
            const res = await request(app)
                .post("/notifications/test")
                .set("Authorization", token);
            expect(res.status).toBe(200);
            expect(res.body.notification).toBeDefined();
            expect(res.body.notification.type).toBe("SYSTEM");

            const persisted = await NotificationModel.findOne({ userId, type: "SYSTEM" });
            expect(persisted).not.toBeNull();
            expect(persisted!.title).toBe("Test Notification");
        });
    });

    describe("error handling paths", () => {
        it("returns 500 when the DB is unreachable (getNotifications)", async () => {
            const spy = jest.spyOn(NotificationModel, "find").mockImplementationOnce(() => {
                throw new Error("boom");
            });
            const res = await request(app)
                .get("/notifications")
                .set("Authorization", token);
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it("returns 500 when the DB throws (getUnreadCount)", async () => {
            const spy = jest.spyOn(NotificationModel, "countDocuments").mockImplementationOnce(() => {
                throw new Error("boom");
            });
            const res = await request(app)
                .get("/notifications/unread-count")
                .set("Authorization", token);
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it("returns 500 when the DB throws (markAllAsRead)", async () => {
            const spy = jest.spyOn(NotificationModel, "updateMany").mockImplementationOnce(() => {
                throw new Error("boom");
            });
            const res = await request(app)
                .put("/notifications/read-all")
                .set("Authorization", token);
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it("returns 500 when the DB throws (registerFcmToken)", async () => {
            const spy = jest.spyOn(UserModel, "findByIdAndUpdate").mockImplementationOnce(() => {
                throw new Error("boom");
            });
            const res = await request(app)
                .post("/notifications/fcm-token")
                .set("Authorization", token)
                .send({ token: "abc" });
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it("returns 500 when the DB throws (unregisterFcmToken)", async () => {
            const spy = jest.spyOn(UserModel, "findByIdAndUpdate").mockImplementationOnce(() => {
                throw new Error("boom");
            });
            const res = await request(app)
                .delete("/notifications/fcm-token")
                .set("Authorization", token)
                .send({ token: "abc" });
            expect(res.status).toBe(500);
            spy.mockRestore();
        });
    });
});
