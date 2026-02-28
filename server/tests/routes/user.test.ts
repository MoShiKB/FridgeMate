import request from "supertest";
import mongoose from "mongoose";
import app from "../../index";
import { token, userId } from "../setup";
import UserModel from "../../models/user.model";

describe("User Routes", () => {
    describe("GET /user", () => {
        it("should return a list of all users", async () => {
            await UserModel.create({
                userName: "anotheruser",
                displayName: "Another User",
                email: "anotheruser@example.com",
                password: "password123",
            });

            const res = await request(app)
                .get("/user")
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBeTruthy();
            expect(res.body.length).toBeGreaterThanOrEqual(1);
        });

        it("should return 401 without auth token", async () => {
            const res = await request(app).get("/user");
            expect(res.status).toBe(403);
        });
    });

    describe("GET /user/:id", () => {
        it("should return user details by id", async () => {
            const res = await request(app)
                .get(`/user/${userId}`)
                .set("Authorization", token);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("_id", userId.toString());
            expect(res.body).toHaveProperty("userName", "testuser");
        });

        it("should return 404 for non-existent user", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .get(`/user/${fakeId}`)
                .set("Authorization", token);

            expect(res.status).toBe(404);
            expect(res.body.message).toBe("User not found");
        });
    });

    describe("PUT /user/:id", () => {
        it("should update user profile", async () => {
            const res = await request(app)
                .put(`/user/${userId}`)
                .set("Authorization", token)
                .send({
                    userId: userId.toString(),
                    userName: "updateduser",
                    profileImage: "https://example.com/new_image.png"
                });

            expect(res.status).toBe(200);
            expect(res.body.userName).toBe("updateduser");
            expect(res.body.profileImage).toBe("https://example.com/new_image.png");

            // Verify in DB
            const updatedUser = await UserModel.findById(userId);
            expect(updatedUser?.userName).toBe("updateduser");
        });

        it("should return 409 if trying to update with existing userName", async () => {
            await UserModel.create({
                userName: "existinguser",
                displayName: "Existing User",
                email: "existinguser@example.com",
                password: "password123",
            });

            const res = await request(app)
                .put(`/user/${userId}`)
                .set("Authorization", token)
                .send({
                    userId: userId.toString(),
                    userName: "existinguser",
                });

            expect(res.status).toBe(409);
            expect(res.body.message).toContain("Duplicate field");
        });
    });
});
