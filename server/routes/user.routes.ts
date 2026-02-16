import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { RecipeController } from "../controllers/recipe.controller";
import { isAuthorized } from "../middlewares/authorization";

const router = Router();

router.get("/", isAuthorized, UserController.getAllUsers);
router.get("/me/recipes", isAuthorized, RecipeController.getUserRecipes);
router.delete("/me/recipes/:id", isAuthorized, RecipeController.deleteFromFavorites);
router.get("/:id", isAuthorized, UserController.getUserById);
router.put("/:id", isAuthorized, UserController.updateProfile);

export default router;
