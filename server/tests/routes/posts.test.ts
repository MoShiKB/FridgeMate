import request from "supertest";
import mongoose from "mongoose";
import app from "../../index";
import { token, userId } from "../setup";
import { PostModel } from "../../models/post.model";

const otherUserId = new mongoose.Types.ObjectId();

describe("Posts Routes", () => {
    describe("POST /posts", () => {
        it("should create a new post", async () => {
            const res = await request(app)
                .post("/posts")
                .set("Authorization", token)
                .send({
                    title: "Test Post",
                    text: "Hello world!",
                    mediaUrls: ["http://example.com/img.jpg"]
                });

            expect(res.status).toBe(201);
            expect(res.body.data).toHaveProperty("_id");
            expect(res.body.data.title).toBe("Test Post");
            expect(res.body.data.text).toBe("Hello world!");
            expect(res.body.data.authorUserId.toString()).toBe(userId.toString());
        });

        it("should return 401 without auth token", async () => {
            const res = await request(app)
                .post("/posts")
                .send({ title: "No auth", text: "test" });

            expect(res.status).toBe(401);
        });
    });

    describe("GET /posts", () => {
        it("should list posts", async () => {
            await PostModel.create({
                authorUserId: userId,
                title: "First Title",
                text: "My first post",
            });

            const res = await request(app)
                .get("/posts")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.items)).toBeTruthy();
            expect(res.body.total).toBeGreaterThanOrEqual(1);
            expect(res.body.items[0].text).toBe("My first post");
            expect(res.body.items[0].authorUserId._id ? res.body.items[0].authorUserId._id.toString() : res.body.items[0].authorUserId.toString()).toBe(userId.toString());
        });

        it("should include commentsCount and likesCount in listed posts", async () => {
            await PostModel.create({
                authorUserId: userId,
                title: "Counts Post",
                text: "Check counts",
            });

            const res = await request(app)
                .get("/posts")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.items[0]).toHaveProperty("commentsCount");
            expect(res.body.items[0]).toHaveProperty("likesCount");
        });
    });

    describe("GET /posts/me", () => {
        it("should return only posts by the authenticated user", async () => {
            await PostModel.create({
                authorUserId: userId,
                title: "My Post",
                text: "My own post",
            });
            await PostModel.create({
                authorUserId: otherUserId,
                title: "Other Post",
                text: "Someone else's post",
            });

            const res = await request(app)
                .get("/posts/me")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.items)).toBeTruthy();
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].title).toBe("My Post");
        });
    });

    describe("POST /posts/:post_id/like", () => {
        it("should like a post", async () => {
            const post = await PostModel.create({
                authorUserId: userId,
                title: "Likeable",
                text: "Like me!",
            });

            const res = await request(app)
                .post(`/posts/${post._id}/like`)
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.data.liked).toBe(true);
            expect(res.body.data.likesCount).toBe(1);
        });

        it("should unlike a previously liked post", async () => {
            const post = await PostModel.create({
                authorUserId: userId,
                title: "Unlikeable",
                text: "Unlike me!",
                likes: [userId],
            });

            const res = await request(app)
                .post(`/posts/${post._id}/like`)
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.data.liked).toBe(false);
            expect(res.body.data.likesCount).toBe(0);
        });

        it("should return 404 for non-existent post", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post(`/posts/${fakeId}/like`)
                .set("Authorization", token);

            expect(res.status).toBe(404);
        });
    });

    describe("PUT /posts/:post_id", () => {
        it("should update an existing post", async () => {
            const post = await PostModel.create({
                authorUserId: userId,
                title: "Old title",
                text: "Old text",
            });

            const res = await request(app)
                .put(`/posts/${post._id}`)
                .set("Authorization", token)
                .send({
                    text: "New text"
                });

            expect(res.status).toBe(200);
            expect(res.body.data.text).toBe("New text");
        });

        it("should return 403 when updating another user's post", async () => {
            const post = await PostModel.create({
                authorUserId: otherUserId,
                title: "Not mine",
                text: "Someone else wrote this",
            });

            const res = await request(app)
                .put(`/posts/${post._id}`)
                .set("Authorization", token)
                .send({ text: "Trying to edit" });

            expect(res.status).toBe(403);
        });
    });

    describe("DELETE /posts/:post_id", () => {
        it("should delete an existing post", async () => {
            const post = await PostModel.create({
                authorUserId: userId,
                title: "Delete me",
                text: "To delete",
            });

            const res = await request(app)
                .delete(`/posts/${post._id}`)
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.data.ok).toBe(true);

            const deletedPost = await PostModel.findById(post._id);
            expect(deletedPost).toBeNull();
        });

        it("should return 403 when deleting another user's post", async () => {
            const post = await PostModel.create({
                authorUserId: otherUserId,
                title: "Not mine",
                text: "Can't delete",
            });

            const res = await request(app)
                .delete(`/posts/${post._id}`)
                .set("Authorization", token);

            expect(res.status).toBe(403);
        });
    });
});
