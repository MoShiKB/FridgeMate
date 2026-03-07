import request from "supertest";
import mongoose from "mongoose";
import app from "../../index";
import { token, userId } from "../setup";
import { PostModel } from "../../models/post.model";
import { CommentModel } from "../../models/comment.model";

describe("Comments Routes", () => {
    let postId: string;

    beforeEach(async () => {
        const post = await PostModel.create({
            authorUserId: userId,
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
            expect(res.body.data.authorUserId.toString()).toBe(userId.toString());
            expect(res.body.data.postId.toString()).toBe(postId);
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

    describe("DELETE /comments/:commentId", () => {
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
    });
});
