import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { RecipeController } from "../controllers/recipe.controller";
import { isAuthorized } from "../middlewares/authorization";
import { validate } from "../middlewares/validate";
import { UserIdParamsSchema, UpdateProfileSchema, PaginationQuerySchema } from "../validators/user.validators";
import { RecipeIdParamsSchema } from "../validators/recipe.validators";

const router = Router();

router.get("/", isAuthorized, UserController.getAllUsers);
router.get("/me/recipes", isAuthorized, validate({ query: PaginationQuerySchema }), RecipeController.getUserFavorites);
router.delete("/me/recipes/:id", isAuthorized, validate({ params: RecipeIdParamsSchema }), RecipeController.removeFromFavorites);
router.get("/:id", isAuthorized, validate({ params: UserIdParamsSchema }), UserController.getUserById);
router.put("/:id", isAuthorized, validate({ params: UserIdParamsSchema, body: UpdateProfileSchema }), UserController.updateProfile);

export default router;
