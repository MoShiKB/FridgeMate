import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { RecipeController } from "../controllers/recipe.controller";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { UserIdParamsSchema, UpdateProfileSchema, PaginationQuerySchema } from "../validators/user.validators";
import { RecipeIdParamsSchema } from "../validators/recipe.validators";

const router = Router();

router.get("/", requireAuth, UserController.getAllUsers);
router.get("/me/recipes", requireAuth, validate({ query: PaginationQuerySchema }), RecipeController.getUserFavorites);
router.delete("/me/recipes/:id", requireAuth, validate({ params: RecipeIdParamsSchema }), RecipeController.removeFromFavorites);
router.get("/:id", requireAuth, validate({ params: UserIdParamsSchema }), UserController.getUserById);
router.put("/:id", requireAuth, validate({ params: UserIdParamsSchema, body: UpdateProfileSchema }), UserController.updateProfile);

export default router;
