import request from "supertest";
import mongoose from "mongoose";
import app from "../../index";
import { token, userId } from "../setup";
import { FridgeModel } from "../../models/fridge.model";
import UserModel from "../../models/user.model";

describe("Fridges Routes", () => {
    describe("POST /fridges", () => {
        it("should create a new fridge", async () => {
            const res = await request(app)
                .post("/fridges")
                .set("Authorization", token)
                .send({
                    name: "My Awesome Fridge"
                });

            expect(res.status).toBe(201);
            expect(res.body.data).toHaveProperty("fridgeId");
            expect(res.body.data).toHaveProperty("inviteCode");

            // Verify user was updated
            const updatedUser = await UserModel.findById(userId);
            expect(updatedUser?.activeFridgeId?.toString()).toBe(res.body.data.fridgeId);
        });
    });

    describe("GET /fridges/me", () => {
        it("should get the user's active fridge", async () => {
            const createRes = await request(app)
                .post("/fridges")
                .set("Authorization", token)
                .send({ name: "Home Fridge" });
            const fridgeId = createRes.body.data.fridgeId;

            const res = await request(app)
                .get("/fridges/me")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe("Home Fridge");
            expect(res.body.data._id).toBe(fridgeId);
        });

        it("should return 404 if no active fridge", async () => {
            await UserModel.updateOne({ _id: userId }, { activeFridgeId: null });

            const res = await request(app)
                .get("/fridges/me")
                .set("Authorization", token);

            expect(res.status).toBe(404);
        });
    });

    describe("POST /fridges/join", () => {
        it("should join a fridge by invite code", async () => {
            const fridge = await FridgeModel.create({
                name: "Shared Fridge",
                members: [],
                inviteCode: "123456"
            });

            const res = await request(app)
                .post("/fridges/join")
                .set("Authorization", token)
                .send({ inviteCode: "123456" });

            expect(res.status).toBe(200);
            expect(res.body.data.fridgeId).toBe(fridge._id.toString());
        });
    });

    describe("GET /fridges/me/members", () => {
        it("should get the members of the active fridge", async () => {
            await request(app)
                .post("/fridges")
                .set("Authorization", token)
                .send({ name: "Family Fridge" });

            const res = await request(app)
                .get("/fridges/me/members")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].userId).toBe(userId.toString());
        });
    });

    describe("POST /fridges/leave", () => {
        it("should leave the current fridge", async () => {
            await request(app)
                .post("/fridges")
                .set("Authorization", token)
                .send({ name: "Old Fridge" });

            const res = await request(app)
                .post("/fridges/leave")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body.data.ok).toBe(true);

            const updatedUser = await UserModel.findById(userId);
            expect(updatedUser?.activeFridgeId).toBeNull();
        });
    });
});
