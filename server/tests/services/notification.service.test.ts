import mongoose from "mongoose";
import UserModel from "../../models/user.model";
import NotificationModel from "../../models/notification.model";

const mockSendEachForMulticast = jest.fn();
const mockGetFirebaseApp = jest.fn();

jest.mock("../../config/firebase", () => ({
    getFirebaseApp: () => mockGetFirebaseApp(),
    initFirebase: jest.fn(),
}));

import { NotificationService } from "../../services/notification.service";
import { userId } from "../setup";

describe("NotificationService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetFirebaseApp.mockReturnValue(null); // by default, no push
    });

    describe("sendNotification — basic persist path", () => {
        it("persists a notification when dedupeBy is not provided", async () => {
            const notif = await NotificationService.sendNotification({
                userId,
                type: "SYSTEM",
                title: "hi",
                message: "there",
            });
            expect(notif).toBeDefined();
            const check = await NotificationModel.findById((notif as any)._id);
            expect(check).not.toBeNull();
            expect(check!.title).toBe("hi");
        });

        it("returns without persisting when skipPersist=true", async () => {
            const before = await NotificationModel.countDocuments();
            const result = await NotificationService.sendNotification({
                userId,
                type: "SYSTEM",
                title: "ephemeral",
                message: "banner",
                skipPersist: true,
            });
            expect(result).toBeUndefined();
            const after = await NotificationModel.countDocuments();
            expect(after).toBe(before);
        });
    });

    describe("sendNotification — dedupe path", () => {
        it("upserts on repeated calls sharing the same dedupe key", async () => {
            const first = await NotificationService.sendNotification({
                userId,
                type: "POST_LIKE",
                title: "Liked #1",
                message: "user liked your post",
                metadata: { postId: "post-1", likerId: "user-A" },
                dedupeBy: ["postId", "likerId"],
            });

            const second = await NotificationService.sendNotification({
                userId,
                type: "POST_LIKE",
                title: "Liked #2 (updated)",
                message: "still liked",
                metadata: { postId: "post-1", likerId: "user-A" },
                dedupeBy: ["postId", "likerId"],
            });

            expect(String((first as any)._id)).toBe(String((second as any)._id));

            const count = await NotificationModel.countDocuments({
                userId,
                type: "POST_LIKE",
            });
            expect(count).toBe(1);

            const doc = await NotificationModel.findById((second as any)._id);
            expect(doc!.title).toBe("Liked #2 (updated)");
        });

        it("creates separate notifications for different dedupe keys", async () => {
            await NotificationService.sendNotification({
                userId,
                type: "POST_LIKE",
                title: "post 1 liked",
                message: "x",
                metadata: { postId: "post-1", likerId: "user-A" },
                dedupeBy: ["postId", "likerId"],
            });
            await NotificationService.sendNotification({
                userId,
                type: "POST_LIKE",
                title: "post 2 liked",
                message: "y",
                metadata: { postId: "post-2", likerId: "user-A" },
                dedupeBy: ["postId", "likerId"],
            });

            const count = await NotificationModel.countDocuments({ userId, type: "POST_LIKE" });
            expect(count).toBe(2);
        });
    });

    describe("sendNotification — push notification path", () => {
        it("skips FCM when the user has no tokens", async () => {
            await NotificationService.sendNotification({
                userId,
                type: "SYSTEM",
                title: "t",
                message: "m",
            });
            // With no fcmTokens on the user, the FCM branch is not entered.
            expect(mockGetFirebaseApp).not.toHaveBeenCalled();
            expect(mockSendEachForMulticast).not.toHaveBeenCalled();
        });

        it("sends via Firebase messaging when tokens exist and app is available", async () => {
            await UserModel.findByIdAndUpdate(userId, {
                $set: { fcmTokens: ["tok-1", "tok-2"] },
            });

            mockSendEachForMulticast.mockResolvedValueOnce({
                failureCount: 0,
                responses: [{ success: true }, { success: true }],
            });
            mockGetFirebaseApp.mockReturnValue({
                messaging: () => ({ sendEachForMulticast: mockSendEachForMulticast }),
            });

            await NotificationService.sendNotification({
                userId,
                type: "SYSTEM",
                title: "hello",
                message: "world",
                metadata: { foo: "bar" },
            });

            expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
            const arg = mockSendEachForMulticast.mock.calls[0][0];
            expect(arg.tokens).toEqual(["tok-1", "tok-2"]);
            expect(arg.notification).toEqual({ title: "hello", body: "world" });
            expect(arg.data.type).toBe("SYSTEM");
            expect(arg.data.metadata).toBe(JSON.stringify({ foo: "bar" }));
        });

        it("prunes failed FCM tokens from the user document", async () => {
            await UserModel.findByIdAndUpdate(userId, {
                $set: { fcmTokens: ["good", "bad-1", "bad-2"] },
            });

            mockSendEachForMulticast.mockResolvedValueOnce({
                failureCount: 2,
                responses: [{ success: true }, { success: false }, { success: false }],
            });
            mockGetFirebaseApp.mockReturnValue({
                messaging: () => ({ sendEachForMulticast: mockSendEachForMulticast }),
            });

            await NotificationService.sendNotification({
                userId,
                type: "SYSTEM",
                title: "t",
                message: "m",
            });

            const after = await UserModel.findById(userId);
            expect(after!.fcmTokens).toEqual(["good"]);
        });

        it("skipPush=true short-circuits before the FCM call", async () => {
            await UserModel.findByIdAndUpdate(userId, {
                $set: { fcmTokens: ["should-not-be-called"] },
            });

            mockGetFirebaseApp.mockReturnValue({
                messaging: () => ({ sendEachForMulticast: mockSendEachForMulticast }),
            });

            const notif = await NotificationService.sendNotification({
                userId,
                type: "SYSTEM",
                title: "t",
                message: "m",
                skipPush: true,
            });

            expect(notif).toBeDefined();
            expect(mockSendEachForMulticast).not.toHaveBeenCalled();
        });

        it("does nothing on FCM path when getFirebaseApp() returns null", async () => {
            await UserModel.findByIdAndUpdate(userId, {
                $set: { fcmTokens: ["tok"] },
            });
            mockGetFirebaseApp.mockReturnValue(null);

            const notif = await NotificationService.sendNotification({
                userId,
                type: "SYSTEM",
                title: "t",
                message: "m",
            });
            expect(notif).toBeDefined();
            expect(mockSendEachForMulticast).not.toHaveBeenCalled();
        });
    });

    describe("sendNotification — error propagation", () => {
        it("re-throws when persistence fails", async () => {
            const spy = jest.spyOn(NotificationModel, "create").mockImplementationOnce(() => {
                throw new Error("db down");
            });
            await expect(
                NotificationService.sendNotification({
                    userId,
                    type: "SYSTEM",
                    title: "t",
                    message: "m",
                })
            ).rejects.toThrow("db down");
            spy.mockRestore();
        });
    });

    describe("removeNotification", () => {
        it("deletes the matching notification and returns it", async () => {
            const doc = await NotificationModel.create({
                userId,
                type: "POST_LIKE",
                title: "t",
                message: "m",
                metadata: { postId: "p-1", likerId: "u-A" },
            });

            const removed = await NotificationService.removeNotification({
                userId,
                type: "POST_LIKE",
                metadata: { postId: "p-1", likerId: "u-A" },
                dedupeBy: ["postId", "likerId"],
            });

            expect(removed).not.toBeNull();
            expect(String((removed as any)._id)).toBe(doc._id.toString());
            const check = await NotificationModel.findById(doc._id);
            expect(check).toBeNull();
        });

        it("returns null when there is no matching notification", async () => {
            const removed = await NotificationService.removeNotification({
                userId,
                type: "POST_LIKE",
                metadata: { postId: "nope", likerId: "nope" },
                dedupeBy: ["postId", "likerId"],
            });
            expect(removed).toBeNull();
        });

        it("re-throws when the DB call fails", async () => {
            const spy = jest.spyOn(NotificationModel, "findOneAndDelete").mockImplementationOnce(() => {
                throw new Error("boom");
            });
            await expect(
                NotificationService.removeNotification({
                    userId,
                    type: "SYSTEM",
                    metadata: { key: "v" },
                    dedupeBy: ["key"],
                })
            ).rejects.toThrow("boom");
            spy.mockRestore();
        });
    });
});
