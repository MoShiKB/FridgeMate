import request from "supertest";
import mongoose from "mongoose";
import app from "../../index";
import testSetup, { token, userId } from "../setup";
import ChatModel from "../../models/chat.model";

describe("Chat Routes", () => {
    const otherUserId = new mongoose.Types.ObjectId();

    describe("GET /chats", () => {
        it("should return empty list when user has no chats", async () => {
            const res = await request(app)
                .get("/chats")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.items).toEqual([]);
            expect(res.body.total).toBe(0);
        });

        it("should return user's chats sorted by lastUpdated", async () => {
            await ChatModel.create({
                participants: [userId, otherUserId],
                messages: [],
                lastMessage: "Hello!",
                lastUpdated: new Date("2025-01-01"),
            });

            const secondUser = new mongoose.Types.ObjectId();
            await ChatModel.create({
                participants: [userId, secondUser],
                messages: [],
                lastMessage: "Recent chat",
                lastUpdated: new Date("2025-06-01"),
            });

            const res = await request(app)
                .get("/chats")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(2);
            expect(res.body.total).toBe(2);
            expect(res.body.items[0].lastMessage).toBe("Recent chat");
            expect(res.body.items[1].lastMessage).toBe("Hello!");
        });

        it("should not return chats the user is not part of", async () => {
            const stranger1 = new mongoose.Types.ObjectId();
            const stranger2 = new mongoose.Types.ObjectId();

            await ChatModel.create({
                participants: [stranger1, stranger2],
                messages: [],
                lastMessage: "Not my chat",
                lastUpdated: new Date(),
            });

            const res = await request(app)
                .get("/chats")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(0);
        });

        it("should return 401 without auth token", async () => {
            const res = await request(app).get("/chats");

            expect(res.status).toBe(401);
        });

        it("should include messageCount in chat items", async () => {
            await ChatModel.create({
                participants: [userId, otherUserId],
                messages: [
                    { sender: userId, content: "Hello", status: "sent" },
                    { sender: otherUserId, content: "Hi there!", status: "sent" },
                    { sender: userId, content: "How are you?", status: "read" },
                ],
                lastMessage: "How are you?",
                lastUpdated: new Date(),
            });

            const res = await request(app)
                .get("/chats")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].messageCount).toBe(3);
            expect(res.body.items[0].lastMessage).toBe("How are you?");
        });
    });
});
