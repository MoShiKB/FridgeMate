import mongoose from "mongoose";
import bcrypt from "bcrypt";

// Mock NotificationService up-front so fire-and-forget notifications from
// FridgesService don't leak DB work into subsequent tests.
jest.mock("../../services/notification.service", () => ({
    NotificationService: {
        sendNotification: jest.fn().mockResolvedValue(undefined),
        removeNotification: jest.fn().mockResolvedValue(undefined),
    },
}));

import { FridgesService } from "../../services/fridges.service";
import { FridgeModel } from "../../models/fridge.model";
import UserModel from "../../models/user.model";
import { userId } from "../setup";

describe("FridgesService", () => {
    let otherUserId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        otherUserId = new mongoose.Types.ObjectId();
        const pwd = await bcrypt.hash("pw", 1);
        await UserModel.create({
            _id: otherUserId,
            userName: "otherfs",
            displayName: "Other FS",
            email: `other-fs-${Date.now()}@example.com`,
            password: pwd,
        });
    });

    describe("createFridge", () => {
        it("creates a fridge with the caller as the sole member and sets activeFridgeId", async () => {
            const fridge = await FridgesService.createFridge(userId.toString(), "My Fridge");
            expect(fridge.name).toBe("My Fridge");
            expect(fridge.members).toHaveLength(1);
            expect(fridge.members[0].userId.toString()).toBe(userId.toString());
            expect(fridge.inviteCode).toMatch(/^[A-Z0-9]{6}$/);

            const user = await UserModel.findById(userId);
            expect(user!.activeFridgeId?.toString()).toBe(fridge._id.toString());
        });
    });

    describe("joinByInviteCode", () => {
        it("adds the user to a fridge given a valid code (case & whitespace insensitive)", async () => {
            const fridge = await FridgeModel.create({
                name: "Existing",
                inviteCode: "ABC123",
                members: [{ userId: otherUserId, joinedAt: new Date() }],
            });

            const joined = await FridgesService.joinByInviteCode(userId.toString(), "  abc123  ");
            expect(joined._id.toString()).toBe(fridge._id.toString());
            expect(joined.members).toHaveLength(2);

            const user = await UserModel.findById(userId);
            expect(user!.activeFridgeId?.toString()).toBe(fridge._id.toString());
        });

        it("throws 400 INVITE_REQUIRED when the invite code is blank", async () => {
            await expect(FridgesService.joinByInviteCode(userId.toString(), "   "))
                .rejects.toMatchObject({ status: 400, code: "INVITE_REQUIRED" });
        });

        it("throws 400 INVITE_REQUIRED when the invite code is missing entirely", async () => {
            await expect(FridgesService.joinByInviteCode(userId.toString(), undefined as any))
                .rejects.toMatchObject({ status: 400, code: "INVITE_REQUIRED" });
        });

        it("throws 404 INVITE_NOT_FOUND for an unknown code", async () => {
            await expect(FridgesService.joinByInviteCode(userId.toString(), "NOPE99"))
                .rejects.toMatchObject({ status: 404, code: "INVITE_NOT_FOUND" });
        });

        it("throws 409 ALREADY_IN_FRIDGE if the user is already a member", async () => {
            await FridgeModel.create({
                name: "Existing",
                inviteCode: "SAME99",
                members: [{ userId: new mongoose.Types.ObjectId(userId), joinedAt: new Date() }],
            });
            await expect(FridgesService.joinByInviteCode(userId.toString(), "SAME99"))
                .rejects.toMatchObject({ status: 409, code: "ALREADY_IN_FRIDGE" });
        });
    });

    describe("leaveCurrentFridge", () => {
        it("removes the user from their active fridge and clears activeFridgeId", async () => {
            const fridge = await FridgeModel.create({
                name: "Leaving",
                inviteCode: "LEAVE1",
                members: [
                    { userId: new mongoose.Types.ObjectId(userId), joinedAt: new Date() },
                    { userId: otherUserId, joinedAt: new Date() },
                ],
            });
            await UserModel.findByIdAndUpdate(userId, { activeFridgeId: fridge._id });

            const result = await FridgesService.leaveCurrentFridge(userId.toString());
            expect(result.ok).toBe(true);

            const check = await FridgeModel.findById(fridge._id);
            expect(check!.members).toHaveLength(1);
            expect(check!.members[0].userId.toString()).toBe(otherUserId.toString());

            const user = await UserModel.findById(userId);
            expect(user!.activeFridgeId).toBeNull();
        });

        it("deletes the fridge when the last member leaves", async () => {
            const fridge = await FridgeModel.create({
                name: "Solo",
                inviteCode: "SOLO01",
                members: [{ userId: new mongoose.Types.ObjectId(userId), joinedAt: new Date() }],
            });
            await UserModel.findByIdAndUpdate(userId, { activeFridgeId: fridge._id });

            await FridgesService.leaveCurrentFridge(userId.toString());

            const check = await FridgeModel.findById(fridge._id);
            expect(check).toBeNull();
        });

        it("throws 400 NO_ACTIVE_FRIDGE when the user is not in a fridge", async () => {
            await UserModel.findByIdAndUpdate(userId, { activeFridgeId: null });
            await expect(FridgesService.leaveCurrentFridge(userId.toString()))
                .rejects.toMatchObject({ status: 400, code: "NO_ACTIVE_FRIDGE" });
        });

        it("throws 404 USER_NOT_FOUND for an unknown user", async () => {
            const ghost = new mongoose.Types.ObjectId().toString();
            await expect(FridgesService.leaveCurrentFridge(ghost))
                .rejects.toMatchObject({ status: 404, code: "USER_NOT_FOUND" });
        });

        it("throws 404 FRIDGE_NOT_FOUND when activeFridgeId points nowhere", async () => {
            await UserModel.findByIdAndUpdate(userId, {
                activeFridgeId: new mongoose.Types.ObjectId(),
            });
            await expect(FridgesService.leaveCurrentFridge(userId.toString()))
                .rejects.toMatchObject({ status: 404, code: "FRIDGE_NOT_FOUND" });
        });
    });

    describe("getMyFridge / getMyFridgeMembers", () => {
        it("returns the user's active fridge", async () => {
            const f = await FridgeModel.create({
                name: "Mine",
                inviteCode: "MINE01",
                members: [{ userId: new mongoose.Types.ObjectId(userId), joinedAt: new Date() }],
            });
            await UserModel.findByIdAndUpdate(userId, { activeFridgeId: f._id });

            const got = await FridgesService.getMyFridge(userId.toString());
            expect(got._id.toString()).toBe(f._id.toString());
        });

        it("throws 404 NO_ACTIVE_FRIDGE when the user has none", async () => {
            await UserModel.findByIdAndUpdate(userId, { activeFridgeId: null });
            await expect(FridgesService.getMyFridge(userId.toString()))
                .rejects.toMatchObject({ status: 404, code: "NO_ACTIVE_FRIDGE" });
        });

        it("throws 404 USER_NOT_FOUND for an unknown user", async () => {
            const ghost = new mongoose.Types.ObjectId().toString();
            await expect(FridgesService.getMyFridge(ghost))
                .rejects.toMatchObject({ status: 404, code: "USER_NOT_FOUND" });
        });

        it("throws 404 FRIDGE_NOT_FOUND when the fridge doc is missing", async () => {
            await UserModel.findByIdAndUpdate(userId, {
                activeFridgeId: new mongoose.Types.ObjectId(),
            });
            await expect(FridgesService.getMyFridge(userId.toString()))
                .rejects.toMatchObject({ status: 404, code: "FRIDGE_NOT_FOUND" });
        });

        it("lists members with displayName / profileImage / userId", async () => {
            const f = await FridgeModel.create({
                name: "Group",
                inviteCode: "GROUP0",
                members: [
                    { userId: new mongoose.Types.ObjectId(userId), joinedAt: new Date() },
                    { userId: otherUserId, joinedAt: new Date() },
                ],
            });
            await UserModel.findByIdAndUpdate(userId, { activeFridgeId: f._id });

            const members = await FridgesService.getMyFridgeMembers(userId.toString());
            expect(members).toHaveLength(2);
            expect(members.map((m) => m.userId).sort()).toEqual(
                [userId.toString(), otherUserId.toString()].sort()
            );
        });
    });
});
