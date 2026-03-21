import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { CommentsController } from "../controllers/comments.controller";
import {
  CreateCommentSchema,
  PostCommentIdParamsSchema,
  PostIdParamsSchema,
  UpdateCommentSchema,
} from "../validators/comments.validators";

export const commentsRoutes = Router();

commentsRoutes.get(
  "/:postId/comments",
  requireAuth,
  validate({ params: PostIdParamsSchema }),
  asyncHandler(CommentsController.list)
);

commentsRoutes.post(
  "/:postId/comments",
  requireAuth,
  validate({ params: PostIdParamsSchema, body: CreateCommentSchema }),
  asyncHandler(CommentsController.create)
);

commentsRoutes.put(
  "/:postId/comments/:commentId",
  requireAuth,
  validate({ params: PostCommentIdParamsSchema, body: UpdateCommentSchema }),
  asyncHandler(CommentsController.update)
);

commentsRoutes.delete(
  "/:postId/comments/:commentId",
  requireAuth,
  validate({ params: PostCommentIdParamsSchema }),
  asyncHandler(CommentsController.remove)
);
