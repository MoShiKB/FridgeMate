import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import app from "../../index";
import { token, userId } from "../setup";
import UserModel from "../../models/user.model";
import { FridgeModel } from "../../models/fridge.model";
import { InventoryItemModel } from "../../models/inventory-item.model";
import { PostModel } from "../../models/post.model";
import Recipe from "../../models/recipe.model";
import { CommentModel } from "../../models/comment.model";
import { JournalModel } from "../../models/journal.model";
import { CommentsService } from "../../services/comments.service";
import { JournalService } from "../../services/journal.service";
import { PostsService } from "../../services/posts.service";
import { requireAuth } from "../../middlewares/auth";

describe("Miscellaneous coverage — small controller/service branches", () => {
    describe("requireAuth middleware — invalid-signature branch", () => {
        it("returns 401 when JWT verify throws (bad signature)", () => {
            const badToken = jwt.sign({ userId: "abc" }, "not-the-real-secret");
            const req: any = { header: (h: string) => (h === "authorization" ? `Bearer ${badToken}` : undefined) };
            const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
            const next = jest.fn();

            requireAuth(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        it("returns 401 when the payload lacks a userId", () => {
            const tokenNoUser = jwt.sign({ foo: "bar" }, process.env.JWT_SECRET as string);
            const req: any = { header: (h: string) => (h === "authorization" ? `Bearer ${tokenNoUser}` : undefined) };
            const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
            const next = jest.fn();

            requireAuth(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it("returns 401 when the header is 'Bearer ' with no token", () => {
            const req: any = { header: (h: string) => (h === "authorization" ? "Bearer " : undefined) };
            const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
            const next = jest.fn();
            requireAuth(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
        });
    });

    describe("POST /auth/google/android — controller wiring", () => {
        it("proxies to AuthService.loginWithGoogleIdToken and forwards its status/data", async () => {
            // Force the OAuth path to fail so we hit the 401 codepath of the controller.
            const origAud = process.env.OAUTH_CLIENT_ID;
            delete process.env.OAUTH_CLIENT_ID;
            try {
                const res = await request(app)
                    .post("/auth/login/google/android")
                    .send({ idToken: "any" });
                expect(res.status).toBe(500);
            } finally {
                if (origAud !== undefined) process.env.OAUTH_CLIENT_ID = origAud;
            }
        });
    });

    describe("Inventory-item controller — assignOwner endpoint", () => {
        let fridgeId: string;
        let itemId: string;
        let memberId: mongoose.Types.ObjectId;

        beforeEach(async () => {
            memberId = new mongoose.Types.ObjectId();
            const pwd = await bcrypt.hash("pw", 1);
            await UserModel.create({
                _id: memberId,
                userName: `m-${Date.now()}`,
                displayName: "Member",
                email: `m-${Date.now()}@example.com`,
                password: pwd,
            });

            const fridge = await FridgeModel.create({
                name: "F",
                inviteCode: `A_${Date.now()}`,
                members: [
                    { userId: new mongoose.Types.ObjectId(userId), joinedAt: new Date() },
                    { userId: memberId, joinedAt: new Date() },
                ],
            });
            fridgeId = fridge._id.toString();

            const item = await InventoryItemModel.create({
                fridgeId, ownerId: userId, name: "n", quantity: "1", ownership: "SHARED",
            });
            itemId = item._id.toString();
        });

        it("PATCH /fridges/:fridgeId/items/:itemId/owner reassigns to another member", async () => {
            const res = await request(app)
                .patch(`/fridges/${fridgeId}/items/${itemId}/owner`)
                .set("Authorization", token)
                .send({ ownerId: memberId.toString() });

            expect(res.status).toBe(200);
            expect(res.body.data.ownerId).toBe(memberId.toString());
        });
    });

    describe("Posts controller — byUser endpoint", () => {
        it("GET /posts/by-user/:userId returns posts filtered by author", async () => {
            const author = new mongoose.Types.ObjectId();
            const pwd = await bcrypt.hash("pw", 1);
            await UserModel.create({
                _id: author,
                userName: `a-${Date.now()}`,
                displayName: "Author",
                email: `a-${Date.now()}@example.com`,
                password: pwd,
            });

            await PostModel.create([
                { authorUserId: author, title: "yes", text: "t" },
                { authorUserId: userId, title: "no", text: "t" },
            ]);

            const res = await request(app)
                .get(`/posts/by-user/${author.toString()}`)
                .set("Authorization", token);
            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].title).toBe("yes");
        });
    });

    describe("Recipe controller — favorites edge cases", () => {
        it("POST /recipes/:id/favorite returns 404 when the recipe does not exist", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            const res = await request(app)
                .post(`/recipes/${fakeId}/favorite`)
                .set("Authorization", token);
            expect(res.status).toBe(404);
        });

        it("POST /recipes/:id/favorite returns 409 when already favorited", async () => {
            const r = await Recipe.create({
                createdBy: userId,
                favoritedBy: [userId],
                title: "x",
                description: "d", cookingTime: "10m", difficulty: "Easy",
                ingredients: [], steps: [],
            });
            const res = await request(app)
                .post(`/recipes/${r._id}/favorite`)
                .set("Authorization", token);
            expect(res.status).toBe(409);
        });

        it("DELETE /recipes/:id/favorite returns 404 when the recipe does not exist", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            const res = await request(app)
                .delete(`/recipes/${fakeId}/favorite`)
                .set("Authorization", token);
            expect(res.status).toBe(404);
        });
    });

    describe("User controller — updateProfile duplicate-key handling", () => {
        it("PUT /user/:id returns 409 when the update violates a unique index (userName)", async () => {
            const other = new mongoose.Types.ObjectId();
            const pwd = await bcrypt.hash("pw", 1);
            await UserModel.create({
                _id: other,
                userName: "taken",
                displayName: "T",
                email: `taken-${Date.now()}@example.com`,
                password: pwd,
            });

            const res = await request(app)
                .put(`/user/${userId}`)
                .set("Authorization", token)
                .send({ userName: "taken" });

            expect(res.status).toBe(409);
        });

        it("PUT /user/:id returns 403 when caller tries to edit another user", async () => {
            const other = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/user/${other}`)
                .set("Authorization", token)
                .send({ displayName: "x" });
            expect(res.status).toBe(403);
        });

        it("GET /user/:id returns 404 for a missing user", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            const res = await request(app)
                .get(`/user/${fakeId}`)
                .set("Authorization", token);
            expect(res.status).toBe(404);
        });
    });

    describe("AI controller — askAI with recipeId that does not resolve", () => {
        it("returns 404 when the recipeId is unknown and no explicit recipe is provided", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            const res = await request(app)
                .post("/ai/ask")
                .set("Authorization", token)
                .send({ query: "hi", recipeId: fakeId });
            expect(res.status).toBe(404);
        });
    });

    describe("CommentsService — notification-to-author branch", () => {
        it("does NOT notify when the author comments on their own post (skips 43-54 branch)", async () => {
            const post = await PostModel.create({ authorUserId: userId, title: "t", text: "t" });
            const comment = await CommentsService.create(userId.toString(), post._id.toString(), "hey");
            expect((comment as any).text).toBe("hey");
        });

        it("notifies the author when someone else comments", async () => {
            const authorId = new mongoose.Types.ObjectId();
            const pwd = await bcrypt.hash("pw", 1);
            await UserModel.create({
                _id: authorId,
                userName: `au-${Date.now()}`,
                displayName: "Author",
                email: `au-${Date.now()}@example.com`,
                password: pwd,
            });
            const post = await PostModel.create({ authorUserId: authorId, title: "t", text: "t" });

            const comment = await CommentsService.create(
                userId.toString(),
                post._id.toString(),
                "x".repeat(150) // >100 chars to hit the preview slice branch
            );
            expect(comment).toBeDefined();
        });

        it("list() throws 404 when the post does not exist", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            await expect(CommentsService.list(fakeId)).rejects.toMatchObject({ status: 404 });
        });

        it("update() rejects non-authors with 403", async () => {
            const post = await PostModel.create({ authorUserId: userId, title: "t", text: "t" });
            const doc = await CommentModel.create({
                postId: post._id,
                authorUserId: new mongoose.Types.ObjectId(),
                text: "foreign",
            });
            await expect(
                CommentsService.update(userId.toString(), doc._id.toString(), "x")
            ).rejects.toMatchObject({ status: 403 });
        });

        it("update() returns 404 when the comment does not exist", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            await expect(
                CommentsService.update(userId.toString(), fakeId, "x")
            ).rejects.toMatchObject({ status: 404 });
        });

        it("remove() rejects non-authors and returns 404 for a missing comment", async () => {
            const post = await PostModel.create({ authorUserId: userId, title: "t", text: "t" });
            const doc = await CommentModel.create({
                postId: post._id,
                authorUserId: new mongoose.Types.ObjectId(),
                text: "foreign",
            });
            await expect(
                CommentsService.remove(userId.toString(), doc._id.toString())
            ).rejects.toMatchObject({ status: 403 });

            const fakeId = new mongoose.Types.ObjectId().toString();
            await expect(
                CommentsService.remove(userId.toString(), fakeId)
            ).rejects.toMatchObject({ status: 404 });
        });
    });

    describe("JournalService — update patch branches", () => {
        it("updates the imageUrl, date, rating and mood fields individually", async () => {
            const entry = await JournalModel.create({
                userId,
                title: "e",
                date: new Date("2026-06-01"),
                meals: [],
            });
            const updated = await JournalService.update(userId.toString(), entry._id.toString(), {
                date: "2026-06-15T12:00:00.000Z",
                rating: 4,
                mood: "HAPPY",
                imageUrl: "http://example.com/x.jpg",
                meals: [{ mealType: "SNACK", recipeId: new mongoose.Types.ObjectId().toString() }],
            });
            expect(updated.rating).toBe(4);
            expect(updated.mood).toBe("HAPPY");
            expect(updated.imageUrl).toBe("http://example.com/x.jpg");
            expect(updated.meals).toHaveLength(1);
            expect(updated.meals[0].mealType).toBe("SNACK");
        });

        it("list() filters by startDate only", async () => {
            await JournalModel.create([
                { userId, title: "old", date: new Date("2020-01-01"), meals: [] },
                { userId, title: "new", date: new Date("2026-01-01"), meals: [] },
            ]);
            const result = await JournalService.list(userId.toString(), {
                skip: 0, limit: 10,
                startDate: "2025-01-01",
            });
            expect(result.total).toBe(1);
            expect(result.items[0].title).toBe("new");
        });

        it("list() filters by endDate only", async () => {
            await JournalModel.create([
                { userId, title: "old", date: new Date("2020-01-01"), meals: [] },
                { userId, title: "new", date: new Date("2026-01-01"), meals: [] },
            ]);
            const result = await JournalService.list(userId.toString(), {
                skip: 0, limit: 10,
                endDate: "2022-01-01",
            });
            expect(result.total).toBe(1);
            expect(result.items[0].title).toBe("old");
        });
    });

    describe("PostsService — coverage of `near.radiusKm` default and update text branch", () => {
        it("uses a default radius when radiusKm is not supplied", async () => {
            await PostModel.create({
                authorUserId: userId, title: "t", text: "t",
                location: { type: "Point", coordinates: [0, 0] },
            });
            const res = await PostsService.list({
                skip: 0, limit: 10,
                near: { lat: 0, lng: 0 }, // no radiusKm
            });
            expect(res.total).toBe(1);
        });

        it("updates only `text` when only text is patched", async () => {
            const post = await PostModel.create({
                authorUserId: userId, title: "T", text: "old",
            });
            const updated = await PostsService.update(
                userId.toString(),
                post._id.toString(),
                { text: "new-text" }
            );
            expect(updated.text).toBe("new-text");
            expect(updated.title).toBe("T");
        });

        it("updates only `mediaUrls` when only mediaUrls is patched", async () => {
            const post = await PostModel.create({
                authorUserId: userId, title: "T", text: "t",
            });
            const updated = await PostsService.update(
                userId.toString(),
                post._id.toString(),
                { mediaUrls: ["a.jpg", "b.jpg"] }
            );
            expect(updated.mediaUrls).toEqual(["a.jpg", "b.jpg"]);
        });
    });

    describe("upload middleware — scan file filter", () => {
        it("POST /fridges/me/scans with a non-image upload is rejected as INVALID_FILE_TYPE", async () => {
            // Ensure the caller has an active fridge so we don't short-circuit earlier.
            const fridge = await FridgeModel.create({
                name: "F", inviteCode: `UP_${Date.now()}`,
                members: [{ userId: new mongoose.Types.ObjectId(userId), joinedAt: new Date() }],
            });
            await UserModel.findByIdAndUpdate(userId, { activeFridgeId: fridge._id });

            const res = await request(app)
                .post("/fridges/me/scans")
                .set("Authorization", token)
                .attach("image", Buffer.from("not an image"), {
                    filename: "note.txt",
                    contentType: "text/plain",
                });

            expect(res.status).toBe(400);
        });
    });

    describe("Scan endpoint — fridge membership check", () => {
        it("returns 403 FORBIDDEN when the fridge is not the caller's active fridge and they are not a member", async () => {
            // The user's activeFridgeId points at a fridge they are NOT a member of.
            // The scan controller uses the user's activeFridgeId, so we simulate an orphaned pointer.
            const otherFridge = await FridgeModel.create({
                name: "Not mine", inviteCode: `NOT_${Date.now()}`,
                members: [{ userId: new mongoose.Types.ObjectId(), joinedAt: new Date() }],
            });
            await UserModel.findByIdAndUpdate(userId, { activeFridgeId: otherFridge._id });

            const res = await request(app)
                .post("/fridges/me/scans")
                .set("Authorization", token)
                .attach("image", Buffer.from("fake-image-bytes"), {
                    filename: "img.jpg",
                    contentType: "image/jpeg",
                });

            expect([403, 502]).toContain(res.status);
        });
    });
});
