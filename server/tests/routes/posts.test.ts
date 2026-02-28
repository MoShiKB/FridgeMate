import request from "supertest";
import mongoose from "mongoose";
import app from "../../index";
import { token, userId } from "../setup";
import { PostModel } from "../../models/post.model";

describe("Posts Routes", () => {
    describe("POST /posts", () => {
        it("should create a new post", async () => {
            const res = await request(app)
                .post("/posts")
                .set("Authorization", token)
                .send({
                    text: "Hello world!",
                    mediaUrls: ["http://example.com/img.jpg"]
                });

            expect(res.status).toBe(201);
            expect(res.body.data).toHaveProperty("_id");
            expect(res.body.data.text).toBe("Hello world!");
            expect(res.body.data.authorUserId.toString()).toBe(userId.toString());
        });
    });

    describe("GET /posts", () => {
        it("should list posts", async () => {
            await PostModel.create({
                authorUserId: userId,
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
    });

    describe("PUT /posts/:post_id", () => {
        it("should update an existing post", async () => {
            const post = await PostModel.create({
                authorUserId: userId,
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
    });

    describe("DELETE /posts/:post_id", () => {
        it("should delete an existing post", async () => {
            const post = await PostModel.create({
                authorUserId: userId,
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
    });
});
