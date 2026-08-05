import mongoose from "mongoose";
import bcrypt from "bcrypt";

// Same reason as in fridges.service.test.ts: prevent fire-and-forget notification
// work from leaking DB writes into later tests.
jest.mock("../../services/notification.service", () => ({
    NotificationService: {
        sendNotification: jest.fn().mockResolvedValue(undefined),
        removeNotification: jest.fn().mockResolvedValue(undefined),
    },
}));

import { PostsService } from "../../services/posts.service";
import { PostModel } from "../../models/post.model";
import { CommentModel } from "../../models/comment.model";
import UserModel from "../../models/user.model";
import { userId } from "../setup";

describe("PostsService (branches)", () => {
    let followedId: mongoose.Types.ObjectId;
    let strangerId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        followedId = new mongoose.Types.ObjectId();
        strangerId = new mongoose.Types.ObjectId();
        const pwd = await bcrypt.hash("pw", 1);
        await UserModel.create([
            {
                _id: followedId,
                userName: "followed",
                displayName: "Followed",
                email: `followed-${Date.now()}@example.com`,
                password: pwd,
            },
            {
                _id: strangerId,
                userName: "stranger",
                displayName: "Stranger",
                email: `stranger-${Date.now()}@example.com`,
                password: pwd,
            },
        ]);
        await UserModel.findByIdAndUpdate(userId, { $set: { following: [followedId] } });
    });

    describe("create", () => {
        it("creates a post with a location payload converted to GeoJSON", async () => {
            const post = await PostsService.create(userId.toString(), {
                title: "Yum",
                text: "look at this",
                mediaUrls: ["a.jpg"],
                location: { lat: 40, lng: -73, placeName: "NYC" },
            });
            expect(post.title).toBe("Yum");
            expect((post as any).location.type).toBe("Point");
            expect((post as any).location.coordinates).toEqual([-73, 40]);
            expect((post as any).location.placeName).toBe("NYC");
        });

        it("creates a post with a linked recipeId", async () => {
            const recipeId = new mongoose.Types.ObjectId().toString();
            const post = await PostsService.create(userId.toString(), {
                title: "T",
                text: "T",
                recipeId,
            });
            expect(post.recipeId?.toString()).toBe(recipeId);
        });

        it("creates a post without location", async () => {
            const post = await PostsService.create(userId.toString(), {
                title: "no loc",
                text: "t",
            });
            expect((post as any).location).toBeNull();
        });
    });

    describe("list — scope=following", () => {
        it("returns only posts from users the caller follows", async () => {
            await PostModel.create([
                { authorUserId: followedId, title: "yes", text: "y" },
                { authorUserId: strangerId, title: "no", text: "n" },
            ]);
            const result = await PostsService.list({
                skip: 0, limit: 50,
                userId: userId.toString(),
                scope: "following",
            });
            expect(result.total).toBe(1);
            expect(result.items[0].title).toBe("yes");
        });

        it("returns empty when the caller follows nobody", async () => {
            await UserModel.findByIdAndUpdate(userId, { $set: { following: [] } });
            await PostModel.create({ authorUserId: strangerId, title: "hi", text: "t" });
            const result = await PostsService.list({
                skip: 0, limit: 50,
                userId: userId.toString(),
                scope: "following",
            });
            expect(result.total).toBe(0);
            expect(result.items).toEqual([]);
        });

        it("returns empty when scope=following has no userId (unauthed)", async () => {
            const result = await PostsService.list({
                skip: 0, limit: 50,
                scope: "following",
            });
            expect(result.total).toBe(0);
            expect(result.items).toEqual([]);
        });
    });

    describe("list — filters", () => {
        it("filters by authorId", async () => {
            await PostModel.create([
                { authorUserId: followedId, title: "keep", text: "y" },
                { authorUserId: strangerId, title: "skip", text: "n" },
            ]);
            const result = await PostsService.list({
                skip: 0, limit: 50,
                authorId: followedId.toString(),
            });
            expect(result.total).toBe(1);
            expect(result.items[0].title).toBe("keep");
        });

        it("filters by geospatial `near`", async () => {
            await PostModel.create([
                {
                    authorUserId: followedId, title: "close", text: "t",
                    location: { type: "Point", coordinates: [-73.99, 40.75] },
                },
                {
                    authorUserId: followedId, title: "far", text: "t",
                    location: { type: "Point", coordinates: [139.69, 35.68] }, // Tokyo
                },
            ]);
            const result = await PostsService.list({
                skip: 0, limit: 50,
                near: { lat: 40.75, lng: -74.0, radiusKm: 25 },
            });
            expect(result.total).toBe(1);
            expect(result.items[0].title).toBe("close");
        });

        it("computes isLiked / isOwner / commentsCount / isFollowingAuthor when userId is provided", async () => {
            const p1 = await PostModel.create({
                authorUserId: followedId, title: "hers", text: "t",
                likes: [new mongoose.Types.ObjectId(userId)],
            });
            const p2 = await PostModel.create({
                authorUserId: userId, title: "mine", text: "t",
            });

            await CommentModel.create([
                { postId: p1._id, authorUserId: userId, text: "c1" },
                { postId: p1._id, authorUserId: userId, text: "c2" },
            ]);

            const result = await PostsService.list({
                skip: 0, limit: 50,
                userId: userId.toString(),
            });

            const hers = result.items.find((i: any) => i._id.toString() === p1._id.toString())!;
            const mine = result.items.find((i: any) => i._id.toString() === p2._id.toString())!;

            expect((hers as any).isLiked).toBe(true);
            expect((hers as any).isOwner).toBe(false);
            expect((hers as any).commentsCount).toBe(2);
            expect((hers as any).isFollowingAuthor).toBe(true);
            expect((mine as any).isOwner).toBe(true);
            expect((mine as any).isFollowingAuthor).toBe(false);
        });
    });

    describe("update", () => {
        it("updates only fields provided in the patch", async () => {
            const post = await PostModel.create({
                authorUserId: userId, title: "old", text: "old-text", mediaUrls: ["u.jpg"],
            });
            const updated = await PostsService.update(userId.toString(), post._id.toString(), {
                title: "new",
            });
            expect(updated.title).toBe("new");
            expect(updated.text).toBe("old-text");
        });

        it("sets location=null when patch.location === null", async () => {
            const post = await PostModel.create({
                authorUserId: userId, title: "t", text: "t",
                location: { type: "Point", coordinates: [0, 0] },
            });
            const updated = await PostsService.update(userId.toString(), post._id.toString(), {
                location: null,
            });
            expect((updated as any).location).toBeNull();
        });

        it("replaces location when patch supplies new coords", async () => {
            const post = await PostModel.create({
                authorUserId: userId, title: "t", text: "t",
            });
            const updated = await PostsService.update(userId.toString(), post._id.toString(), {
                location: { lat: 1, lng: 2, placeName: "P" },
            });
            expect((updated as any).location.coordinates).toEqual([2, 1]);
            expect((updated as any).location.placeName).toBe("P");
        });

        it("throws 403 when non-author tries to update", async () => {
            const post = await PostModel.create({
                authorUserId: strangerId, title: "t", text: "t",
            });
            await expect(
                PostsService.update(userId.toString(), post._id.toString(), { title: "x" })
            ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
        });

        it("throws 404 for a non-existent post", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            await expect(
                PostsService.update(userId.toString(), fakeId, { title: "x" })
            ).rejects.toMatchObject({ status: 404, code: "POST_NOT_FOUND" });
        });
    });

    describe("remove", () => {
        it("removes the post and its comments (author)", async () => {
            const post = await PostModel.create({
                authorUserId: userId, title: "t", text: "t",
            });
            await CommentModel.create([
                { postId: post._id, authorUserId: userId, text: "c1" },
                { postId: post._id, authorUserId: userId, text: "c2" },
            ]);

            const res = await PostsService.remove(userId.toString(), post._id.toString());
            expect(res.ok).toBe(true);
            expect(await PostModel.findById(post._id)).toBeNull();
            expect(await CommentModel.countDocuments({ postId: post._id })).toBe(0);
        });

        it("throws 403 for non-author", async () => {
            const post = await PostModel.create({
                authorUserId: strangerId, title: "t", text: "t",
            });
            await expect(
                PostsService.remove(userId.toString(), post._id.toString())
            ).rejects.toMatchObject({ status: 403 });
        });

        it("throws 404 for a non-existent post", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            await expect(
                PostsService.remove(userId.toString(), fakeId)
            ).rejects.toMatchObject({ status: 404, code: "POST_NOT_FOUND" });
        });
    });

    describe("toggleLike", () => {
        it("adds a like when not previously liked", async () => {
            const post = await PostModel.create({
                authorUserId: strangerId, title: "t", text: "t",
            });
            const result = await PostsService.toggleLike(userId.toString(), post._id.toString());
            expect(result.liked).toBe(true);
            expect(result.likesCount).toBe(1);
        });

        it("removes a like when already liked", async () => {
            const post = await PostModel.create({
                authorUserId: strangerId, title: "t", text: "t",
                likes: [new mongoose.Types.ObjectId(userId)],
            });
            const result = await PostsService.toggleLike(userId.toString(), post._id.toString());
            expect(result.liked).toBe(false);
            expect(result.likesCount).toBe(0);
        });

        it("does not notify when the author likes their own post", async () => {
            const post = await PostModel.create({
                authorUserId: userId, title: "t", text: "t",
            });
            const result = await PostsService.toggleLike(userId.toString(), post._id.toString());
            expect(result.liked).toBe(true);
        });

        it("throws 404 for a non-existent post", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            await expect(
                PostsService.toggleLike(userId.toString(), fakeId)
            ).rejects.toMatchObject({ status: 404, code: "POST_NOT_FOUND" });
        });
    });
});
