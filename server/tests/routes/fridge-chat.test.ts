import request from "supertest";
import mongoose from "mongoose";
import app from "../../index";
import { token, userId } from "../setup";
import { FridgeModel } from "../../models/fridge.model";
import FridgeChatReadModel from "../../models/fridge-chat-read.model";
import UserModel from "../../models/user.model";
import { FridgeChatService } from "../../services/fridge-chat.service";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

describe("Fridge Chat", () => {
    let fridgeId: string;
    let otherUserId: mongoose.Types.ObjectId;
    let otherToken: string;

    beforeEach(async () => {
        otherUserId = new mongoose.Types.ObjectId();
        const pwd = await bcrypt.hash("pw", 1);
        await UserModel.create({
            _id: otherUserId,
            userName: "other",
            displayName: "Other User",
            email: `other-${Date.now()}@example.com`,
            password: pwd,
        });
        otherToken = `Bearer ${jwt.sign({ userId: otherUserId.toString() }, process.env.JWT_SECRET as string, { expiresIn: "1h" })}`;

        const fridge = await FridgeModel.create({
            name: "Chat Fridge",
            inviteCode: `CHAT_${Date.now()}`,
            members: [
                { userId: new mongoose.Types.ObjectId(userId), joinedAt: new Date() },
                { userId: otherUserId, joinedAt: new Date() },
            ],
        });
        fridgeId = fridge._id.toString();
    });

    describe("GET /fridges/:fridgeId/chat/messages", () => {
        it("returns empty messages and hasMore=false for a brand-new chat", async () => {
            const res = await request(app)
                .get(`/fridges/${fridgeId}/chat/messages`)
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.items).toEqual([]);
            expect(res.body.hasMore).toBe(false);
        });

        it("returns messages after they are appended", async () => {
            await FridgeChatService.appendMessage(fridgeId, userId.toString(), "Hello");
            await FridgeChatService.appendMessage(fridgeId, otherUserId.toString(), "Hi back");

            const res = await request(app)
                .get(`/fridges/${fridgeId}/chat/messages`)
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(2);
            expect(res.body.items[0].content).toBe("Hello");
            expect(res.body.items[1].content).toBe("Hi back");
            expect(res.body.hasMore).toBe(false);
        });

        it("respects the limit query parameter and reports hasMore=true", async () => {
            for (let i = 0; i < 5; i++) {
                await FridgeChatService.appendMessage(fridgeId, userId.toString(), `msg-${i}`);
            }

            const res = await request(app)
                .get(`/fridges/${fridgeId}/chat/messages?limit=2`)
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(2);
            expect(res.body.items[0].content).toBe("msg-3");
            expect(res.body.items[1].content).toBe("msg-4");
            expect(res.body.hasMore).toBe(true);
        });

        it("supports paging with the `before` cursor", async () => {
            const created: string[] = [];
            for (let i = 0; i < 4; i++) {
                const m = await FridgeChatService.appendMessage(fridgeId, userId.toString(), `m-${i}`);
                created.push((m as any)._id.toString());
            }

            const res = await request(app)
                .get(`/fridges/${fridgeId}/chat/messages?before=${created[2]}&limit=10`)
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(2);
            expect(res.body.items.map((m: any) => m.content)).toEqual(["m-0", "m-1"]);
        });

        it("clamps limit to the MAX_PAGE upper bound", async () => {
            await FridgeChatService.appendMessage(fridgeId, userId.toString(), "one");
            const res = await request(app)
                .get(`/fridges/${fridgeId}/chat/messages?limit=99999`)
                .set("Authorization", token);
            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
        });

        it("rejects a non-member with 403", async () => {
            const strangerId = new mongoose.Types.ObjectId();
            const strangerToken = `Bearer ${jwt.sign(
                { userId: strangerId.toString() },
                process.env.JWT_SECRET as string,
                { expiresIn: "1h" }
            )}`;

            const res = await request(app)
                .get(`/fridges/${fridgeId}/chat/messages`)
                .set("Authorization", strangerToken);

            expect(res.status).toBe(403);
        });

        it("returns 400 for an invalid fridgeId", async () => {
            const res = await request(app)
                .get(`/fridges/not-an-id/chat/messages`)
                .set("Authorization", token);
            expect(res.status).toBe(400);
        });

        it("returns 400 for an invalid `before` cursor", async () => {
            await FridgeChatService.appendMessage(fridgeId, userId.toString(), "hi");
            const res = await request(app)
                .get(`/fridges/${fridgeId}/chat/messages?before=not-an-id`)
                .set("Authorization", token);
            expect(res.status).toBe(400);
        });

        it("requires authentication", async () => {
            const res = await request(app).get(`/fridges/${fridgeId}/chat/messages`);
            expect(res.status).toBe(401);
        });
    });

    describe("POST /fridges/:fridgeId/chat/read", () => {
        it("upserts a read marker and returns 204", async () => {
            const res = await request(app)
                .post(`/fridges/${fridgeId}/chat/read`)
                .set("Authorization", token);
            expect(res.status).toBe(204);

            const read = await FridgeChatReadModel.findOne({ fridgeId, userId });
            expect(read).not.toBeNull();
            expect(read!.lastReadAt).toBeInstanceOf(Date);
        });

        it("updates the read marker when called again", async () => {
            await request(app).post(`/fridges/${fridgeId}/chat/read`).set("Authorization", token);
            const first = await FridgeChatReadModel.findOne({ fridgeId, userId });

            await new Promise((r) => setTimeout(r, 10));

            await request(app).post(`/fridges/${fridgeId}/chat/read`).set("Authorization", token);
            const second = await FridgeChatReadModel.findOne({ fridgeId, userId });

            expect(second!.lastReadAt.getTime()).toBeGreaterThan(first!.lastReadAt.getTime());
        });

        it("rejects a non-member with 403", async () => {
            const strangerId = new mongoose.Types.ObjectId();
            const strangerToken = `Bearer ${jwt.sign(
                { userId: strangerId.toString() },
                process.env.JWT_SECRET as string,
                { expiresIn: "1h" }
            )}`;
            const res = await request(app)
                .post(`/fridges/${fridgeId}/chat/read`)
                .set("Authorization", strangerToken);
            expect(res.status).toBe(403);
        });
    });

    describe("GET /fridges/:fridgeId/chat/unread-count", () => {
        it("returns 0 when there are no messages", async () => {
            const res = await request(app)
                .get(`/fridges/${fridgeId}/chat/unread-count`)
                .set("Authorization", token);
            expect(res.status).toBe(200);
            expect(res.body.unreadCount).toBe(0);
        });

        it("counts messages authored by other members after last-read (or join)", async () => {
            await FridgeChatService.appendMessage(fridgeId, otherUserId.toString(), "one");
            await FridgeChatService.appendMessage(fridgeId, otherUserId.toString(), "two");
            await FridgeChatService.appendMessage(fridgeId, userId.toString(), "self");

            const res = await request(app)
                .get(`/fridges/${fridgeId}/chat/unread-count`)
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.unreadCount).toBe(2);
        });

        it("returns 0 immediately after marking as read", async () => {
            await FridgeChatService.appendMessage(fridgeId, otherUserId.toString(), "hi");

            await request(app).post(`/fridges/${fridgeId}/chat/read`).set("Authorization", token);

            const res = await request(app)
                .get(`/fridges/${fridgeId}/chat/unread-count`)
                .set("Authorization", token);
            expect(res.body.unreadCount).toBe(0);
        });
    });
});

describe("FridgeChatService (direct unit tests)", () => {
    let fridgeId: string;
    let otherUserId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        otherUserId = new mongoose.Types.ObjectId();
        const pwd = await bcrypt.hash("pw", 1);
        await UserModel.create({
            _id: otherUserId,
            userName: "other2",
            displayName: "Other Two",
            email: `other2-${Date.now()}@example.com`,
            password: pwd,
        });

        const fridge = await FridgeModel.create({
            name: "Direct Fridge",
            inviteCode: `DIRECT_${Date.now()}`,
            members: [
                { userId: new mongoose.Types.ObjectId(userId), joinedAt: new Date() },
                { userId: otherUserId, joinedAt: new Date() },
            ],
        });
        fridgeId = fridge._id.toString();
    });

    describe("appendMessage", () => {
        it("rejects an empty text message", async () => {
            await expect(
                FridgeChatService.appendMessage(fridgeId, userId.toString(), "   ")
            ).rejects.toMatchObject({ status: 400 });
        });

        it("rejects a message longer than 2000 chars", async () => {
            const huge = "x".repeat(2001);
            await expect(
                FridgeChatService.appendMessage(fridgeId, userId.toString(), huge)
            ).rejects.toMatchObject({ status: 400 });
        });

        it("appends a recipe_share with synthesized fallback content", async () => {
            const msg = await FridgeChatService.appendMessage(
                fridgeId,
                userId.toString(),
                "",
                { type: "recipe_share", payload: { recipeId: "abc123", title: "Pancakes" } }
            );
            expect((msg as any).type).toBe("recipe_share");
            expect((msg as any).content).toBe("Shared a recipe: Pancakes");
        });

        it("keeps caller-supplied content for a recipe_share", async () => {
            const msg = await FridgeChatService.appendMessage(
                fridgeId,
                userId.toString(),
                "Look at this!",
                { type: "recipe_share", payload: { recipeId: "abc", title: "Toast" } }
            );
            expect((msg as any).content).toBe("Look at this!");
        });

        it("rejects a recipe_share without payload", async () => {
            await expect(
                FridgeChatService.appendMessage(fridgeId, userId.toString(), "x", {
                    type: "recipe_share",
                    payload: undefined as any,
                })
            ).rejects.toMatchObject({ status: 400 });
        });

        it("rejects a recipe_share missing recipeId", async () => {
            await expect(
                FridgeChatService.appendMessage(fridgeId, userId.toString(), "x", {
                    type: "recipe_share",
                    payload: { title: "no id" } as any,
                })
            ).rejects.toMatchObject({ status: 400 });
        });

        it("rejects a recipe_share missing title", async () => {
            await expect(
                FridgeChatService.appendMessage(fridgeId, userId.toString(), "x", {
                    type: "recipe_share",
                    payload: { recipeId: "abc" } as any,
                })
            ).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("getOrCreate", () => {
        it("returns the same chat document on repeat calls", async () => {
            const a = await FridgeChatService.getOrCreate(fridgeId);
            const b = await FridgeChatService.getOrCreate(fridgeId);
            expect((a as any)._id.toString()).toBe((b as any)._id.toString());
        });
    });

    describe("assertMember / ensureValidObjectId", () => {
        it("rejects invalid fridgeId with 400", async () => {
            await expect(
                FridgeChatService.assertMember("not-an-id", userId.toString())
            ).rejects.toMatchObject({ status: 400 });
        });

        it("rejects a valid fridgeId when the user is not a member", async () => {
            const stranger = new mongoose.Types.ObjectId().toString();
            await expect(
                FridgeChatService.assertMember(fridgeId, stranger)
            ).rejects.toMatchObject({ status: 403 });
        });
    });

    describe("getUnreadCount edge cases", () => {
        it("returns 0 when the chat document does not exist yet", async () => {
            // Fresh fridge, no chat doc created for it.
            const fresh = await FridgeModel.create({
                name: "Empty Chat",
                inviteCode: `EMPTY_${Date.now()}`,
                members: [{ userId: new mongoose.Types.ObjectId(userId), joinedAt: new Date() }],
            });
            const count = await FridgeChatService.getUnreadCount(fresh._id.toString(), userId.toString());
            expect(count).toBe(0);
        });

        it("ignores messages authored by the current user", async () => {
            await FridgeChatService.appendMessage(fridgeId, userId.toString(), "mine1");
            await FridgeChatService.appendMessage(fridgeId, userId.toString(), "mine2");
            const count = await FridgeChatService.getUnreadCount(fridgeId, userId.toString());
            expect(count).toBe(0);
        });

        it("uses fridge join time as the fallback cutoff when no read marker exists", async () => {
            // Message from other user AFTER joinedAt should count
            await FridgeChatService.appendMessage(fridgeId, otherUserId.toString(), "counts");
            const count = await FridgeChatService.getUnreadCount(fridgeId, userId.toString());
            expect(count).toBe(1);
        });
    });

});
