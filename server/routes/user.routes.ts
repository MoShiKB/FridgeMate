import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { RecipeController } from "../controllers/recipe.controller";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuth, UserController.getAllUsers);
router.get("/me/recipes", requireAuth, RecipeController.getUserFavorites);
router.delete("/me/recipes/:id", requireAuth, RecipeController.removeFromFavorites);
router.get("/:id", requireAuth, UserController.getUserById);
router.put("/:id", requireAuth, UserController.updateProfile);

export default router;
