import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { PostsController } from "../controllers/posts.controller";
import { CreatePostSchema, PostIdParamsSchema, PostsQuerySchema, UpdatePostSchema } from "../validators/posts.validators";

export const postsRoutes = Router();

postsRoutes.post("/", requireAuth, validate({ body: CreatePostSchema }), asyncHandler(PostsController.create));
postsRoutes.get("/me", requireAuth, asyncHandler(PostsController.myPosts));
postsRoutes.get("/", requireAuth, validate({ query: PostsQuerySchema }), asyncHandler(PostsController.list));

postsRoutes.post(
  "/:post_id/like",
  requireAuth,
  validate({ params: PostIdParamsSchema }),
  asyncHandler(PostsController.toggleLike)
);

postsRoutes.put(
  "/:post_id",
  requireAuth,
  validate({ params: PostIdParamsSchema, body: UpdatePostSchema }),
  asyncHandler(PostsController.update)
);

postsRoutes.delete(
  "/:post_id",
  requireAuth,
  validate({ params: PostIdParamsSchema }),
  asyncHandler(PostsController.remove)
);
