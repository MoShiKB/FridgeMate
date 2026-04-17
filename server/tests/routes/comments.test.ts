import request from "supertest";
import mongoose from "mongoose";
import app from "../../index";
import { token, userId } from "../setup";
import { PostModel } from "../../models/post.model";
import { CommentModel } from "../../models/comment.model";

const otherUserId = new mongoose.Types.ObjectId();

describe("Comments Routes", () => {
    let postId: string;

    beforeEach(async () => {
        const post = await PostModel.create({
            authorUserId: userId,
            title: "Comment Test Post",
            text: "Post for comments",
        });
        postId = post._id.toString();
    });

    describe("POST /posts/:postId/comments", () => {
        it("should create a comment", async () => {
            const res = await request(app)
                .post(`/posts/${postId}/comments`)
                .set("Authorization", token)
                .send({
                    text: "Nice post!"
                });

            expect(res.status).toBe(201);
            expect(res.body.data).toHaveProperty("_id");
            expect(res.body.data.text).toBe("Nice post!");
            const authorId = res.body.data.authorUserId._id || res.body.data.authorUserId;
            expect(authorId.toString()).toBe(userId.toString());
            expect(res.body.data.postId.toString()).toBe(postId);
        });

        it("should return 404 for a non-existent post", async () => {
            const fakePostId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post(`/posts/${fakePostId}/comments`)
                .set("Authorization", token)
                .send({ text: "Ghost comment" });

            expect(res.status).toBe(404);
        });
    });

    describe("GET /posts/:postId/comments", () => {
        it("should list comments for a post", async () => {
            await CommentModel.create({
                postId: postId,
                authorUserId: userId,
                text: "First comment"
            });

            const res = await request(app)
                .get(`/posts/${postId}/comments`)
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.data.items).toHaveLength(1);
            expect(res.body.data.total).toBe(1);
            expect(res.body.data.items[0].text).toBe("First comment");
            expect(res.body.data.items[0].authorUserId._id ? res.body.data.items[0].authorUserId._id.toString() : res.body.data.items[0].authorUserId.toString()).toBe(userId.toString());
        });
    });

    describe("PUT /posts/:postId/comments/:commentId", () => {
        it("should update a comment", async () => {
            const comment = await CommentModel.create({
                postId: postId,
                authorUserId: userId,
                text: "Original comment"
            });

            const res = await request(app)
                .put(`/posts/${postId}/comments/${comment._id}`)
                .set("Authorization", token)
                .send({ text: "Updated comment" });

            expect(res.status).toBe(200);
            expect(res.body.data.text).toBe("Updated comment");
        });

        it("should return 403 when updating another user's comment", async () => {
            const comment = await CommentModel.create({
                postId: postId,
                authorUserId: otherUserId,
                text: "Not my comment"
            });

            const res = await request(app)
                .put(`/posts/${postId}/comments/${comment._id}`)
                .set("Authorization", token)
                .send({ text: "Trying to edit" });

            expect(res.status).toBe(403);
        });
    });

    describe("DELETE /posts/:postId/comments/:commentId", () => {
        it("should delete a comment", async () => {
            const comment = await CommentModel.create({
                postId: postId,
                authorUserId: userId,
                text: "Comment to delete"
            });

            const res = await request(app)
                .delete(`/posts/${postId}/comments/${comment._id}`)
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.data.ok).toBe(true);

            const deleted = await CommentModel.findById(comment._id);
            expect(deleted).toBeNull();
        });

        it("should return 403 when deleting another user's comment", async () => {
            const comment = await CommentModel.create({
                postId: postId,
                authorUserId: otherUserId,
                text: "Not my comment"
            });

            const res = await request(app)
                .delete(`/posts/${postId}/comments/${comment._id}`)
                .set("Authorization", token);

            expect(res.status).toBe(403);
        });
    });
});
