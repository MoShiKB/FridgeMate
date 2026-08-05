import mongoose from "mongoose";
import bcrypt from "bcrypt";

jest.mock("../../services/notification.service", () => ({
    NotificationService: {
        sendNotification: jest.fn().mockResolvedValue(undefined),
        removeNotification: jest.fn().mockResolvedValue(undefined),
    },
}));

import { UserService } from "../../services/user.service";
import UserModel from "../../models/user.model";
import { userId } from "../setup";

describe("UserService (branches)", () => {
    let otherId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        otherId = new mongoose.Types.ObjectId();
        const pwd = await bcrypt.hash("pw", 1);
        await UserModel.create({
            _id: otherId,
            userName: `friend-${Date.now()}`,
            displayName: "Friend",
            email: `friend-${Date.now()}@example.com`,
            password: pwd,
        });
    });

    describe("lookup helpers", () => {
        it("getUserByEmail returns the user (case-insensitive) with sensitive fields", async () => {
            const user = await UserService.getUserByEmail(`friend`);
            expect(user).toBeNull();

            const friend = await UserModel.findById(otherId);
            const full = await UserService.getUserByEmail(`  ${friend!.email.toUpperCase()}  `);
            expect(full).not.toBeNull();
            expect(full!.password).toBeDefined();
        });

        it("getUserByUserName returns the user (case- and whitespace-insensitive)", async () => {
            const friend = await UserModel.findById(otherId);
            const got = await UserService.getUserByUserName(`  ${friend!.userName!.toUpperCase()}  `);
            expect(got).not.toBeNull();
            expect(got!._id.toString()).toBe(otherId.toString());
        });
    });

    describe("updateProfile — bio field", () => {
        it("updates and trims the bio", async () => {
            const updated = await UserService.updateProfile(userId.toString(), {
                bio: "  a nice bio  ",
            } as any);
            expect(updated!.bio).toBe("a nice bio");
        });
    });

    describe("toggleFollow — validation branches", () => {
        it("throws 400 INVALID_USER_ID when target is not a valid ObjectId", async () => {
            await expect(
                UserService.toggleFollow(userId.toString(), "not-an-id")
            ).rejects.toMatchObject({ status: 400, code: "INVALID_USER_ID" });
        });

        it("throws 400 FOLLOW_SELF when caller equals target", async () => {
            await expect(
                UserService.toggleFollow(userId.toString(), userId.toString())
            ).rejects.toMatchObject({ status: 400, code: "FOLLOW_SELF" });
        });

        it("throws 404 USER_NOT_FOUND when target does not exist", async () => {
            const ghost = new mongoose.Types.ObjectId().toString();
            await expect(
                UserService.toggleFollow(userId.toString(), ghost)
            ).rejects.toMatchObject({ status: 404, code: "USER_NOT_FOUND" });
        });
    });

    describe("toggleFollow — follow / unfollow flow (async .then coverage)", () => {
        it("follows and then unfollows, exercising both branches", async () => {
            const r1 = await UserService.toggleFollow(userId.toString(), otherId.toString());
            expect(r1.following).toBe(true);
            expect(r1.followersCount).toBe(1);

            // Give the fire-and-forget UserModel.findById(...).then(...) a chance to run
            // (this covers the notification .then callback branch in the source).
            await new Promise((r) => setTimeout(r, 30));

            const r2 = await UserService.toggleFollow(userId.toString(), otherId.toString());
            expect(r2.following).toBe(false);
            expect(r2.followersCount).toBe(0);

            await new Promise((r) => setTimeout(r, 30));
        });
    });

    describe("getUserById — visibility branches", () => {
        it("returns null when userId is not a valid ObjectId", async () => {
            const got = await UserService.getUserById("not-an-id");
            expect(got).toBeNull();
        });

        it("returns null when the user does not exist", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            const got = await UserService.getUserById(fakeId);
            expect(got).toBeNull();
        });

        it("returns the caller's own profile with the email preserved", async () => {
            const got = await UserService.getUserById(userId.toString(), userId.toString());
            expect(got).not.toBeNull();
            expect(got.email).toBeDefined();
        });

        it("scrubs the email when a different caller looks up a user", async () => {
            const got = await UserService.getUserById(otherId.toString(), userId.toString());
            expect(got).not.toBeNull();
            expect(got.email).toBeUndefined();
        });

        it("computes isFollowing=true after toggleFollow", async () => {
            await UserService.toggleFollow(userId.toString(), otherId.toString());
            const got = await UserService.getUserById(otherId.toString(), userId.toString());
            expect(got.isFollowing).toBe(true);
        });
    });

    describe("getAllUsers / search", () => {
        it("getAllUsers returns a list with sensitive fields stripped", async () => {
            const list = await UserService.getAllUsers();
            expect(Array.isArray(list)).toBe(true);
            expect(list.length).toBeGreaterThanOrEqual(1);
            for (const u of list) {
                expect((u as any).password).toBeUndefined();
                expect((u as any).refreshToken).toBeUndefined();
                expect((u as any).email).toBeUndefined();
            }
        });

        it("search excludes the caller from results and marks isFollowing correctly", async () => {
            await UserService.toggleFollow(userId.toString(), otherId.toString());
            const result = await UserService.search("", userId.toString(), { skip: 0, limit: 50 });
            expect(result.items.every((u: any) => u._id.toString() !== userId.toString())).toBe(true);
            const otherHit = result.items.find((u: any) => u._id.toString() === otherId.toString());
            expect(otherHit).toBeDefined();
            expect((otherHit as any).isFollowing).toBe(true);
        });

        it("search escapes regex metacharacters in the query", async () => {
            const result = await UserService.search("a.*b", userId.toString(), { skip: 0, limit: 10 });
            expect(result.items).toEqual([]);
            expect(result.total).toBe(0);
        });
    });

    describe("getFollowers / getFollowing / getFollowingIds", () => {
        beforeEach(async () => {
            await UserService.toggleFollow(userId.toString(), otherId.toString());
        });

        it("getFollowers returns the caller for the followed user", async () => {
            const res = await UserService.getFollowers(otherId.toString(), userId.toString(), {
                skip: 0, limit: 20,
            });
            expect(res.total).toBe(1);
            expect(res.items[0]._id.toString()).toBe(userId.toString());
        });

        it("getFollowing returns the followed user for the caller", async () => {
            const res = await UserService.getFollowing(userId.toString(), userId.toString(), {
                skip: 0, limit: 20,
            });
            expect(res.total).toBe(1);
            expect(res.items[0]._id.toString()).toBe(otherId.toString());
        });

        it("getFollowing returns empty when the user is missing", async () => {
            const ghost = new mongoose.Types.ObjectId().toString();
            const res = await UserService.getFollowing(ghost, userId.toString(), {
                skip: 0, limit: 20,
            });
            expect(res).toEqual({ items: [], total: 0 });
        });

        it("getFollowingIds returns the raw ids the user follows", async () => {
            const ids = await UserService.getFollowingIds(userId.toString());
            expect(ids).toHaveLength(1);
            expect(ids[0].toString()).toBe(otherId.toString());
        });
    });
});
