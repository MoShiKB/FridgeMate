import mongoose from "mongoose";
import { RecipeService } from "../../services/recipe.service";
import Recipe from "../../models/recipe.model";
import { userId } from "../setup";

describe("RecipeService", () => {
    describe("isFavoritedByUser", () => {
        it("returns true when the user favorited the recipe", async () => {
            const r = await Recipe.create({
                createdBy: userId,
                favoritedBy: [userId],
                title: "Fav",
                description: "d", cookingTime: "10m", difficulty: "Easy",
                ingredients: [], steps: [],
            });
            const isFav = await RecipeService.isFavoritedByUser(r._id.toString(), userId.toString());
            expect(isFav).toBe(true);
        });

        it("returns false when the user did not favorite the recipe", async () => {
            const r = await Recipe.create({
                createdBy: userId,
                favoritedBy: [],
                title: "NotFav",
                description: "d", cookingTime: "10m", difficulty: "Easy",
                ingredients: [], steps: [],
            });
            const isFav = await RecipeService.isFavoritedByUser(r._id.toString(), userId.toString());
            expect(isFav).toBe(false);
        });

        it("returns false for a non-existent recipe id", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            const isFav = await RecipeService.isFavoritedByUser(fakeId, userId.toString());
            expect(isFav).toBe(false);
        });
    });
});
