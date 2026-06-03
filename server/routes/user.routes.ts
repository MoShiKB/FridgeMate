import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { RecipeController } from "../controllers/recipe.controller";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  UserIdParamsSchema,
  UpdateProfileSchema,
  PaginationQuerySchema,
  UserSearchQuerySchema,
} from "../validators/user.validators";
import { RecipeIdParamsSchema } from "../validators/recipe.validators";

const router = Router();

router.get("/", requireAuth, asyncHandler(UserController.getAllUsers));

router.get(
  "/search",
  requireAuth,
  validate({ query: UserSearchQuerySchema }),
  asyncHandler(UserController.search)
);

router.get("/me/recipes", requireAuth, validate({ query: PaginationQuerySchema }), asyncHandler(RecipeController.getUserFavorites));
router.delete("/me/recipes/:id", requireAuth, validate({ params: RecipeIdParamsSchema }), asyncHandler(RecipeController.removeFromFavorites));

router.get("/:id", requireAuth, validate({ params: UserIdParamsSchema }), asyncHandler(UserController.getUserById));
router.put("/:id", requireAuth, validate({ params: UserIdParamsSchema, body: UpdateProfileSchema }), asyncHandler(UserController.updateProfile));

router.post(
  "/:id/follow",
  requireAuth,
  validate({ params: UserIdParamsSchema }),
  asyncHandler(UserController.toggleFollow)
);

router.get(
  "/:id/followers",
  requireAuth,
  validate({ params: UserIdParamsSchema, query: PaginationQuerySchema }),
  asyncHandler(UserController.getFollowers)
);

router.get(
  "/:id/following",
  requireAuth,
  validate({ params: UserIdParamsSchema, query: PaginationQuerySchema }),
  asyncHandler(UserController.getFollowing)
);

export default router;
