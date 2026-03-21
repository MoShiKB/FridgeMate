import { z } from "zod";

export const PostIdParamsSchema = z.object({ postId: z.string().min(1) });
export const PostCommentIdParamsSchema = z.object({
  postId: z.string().min(1),
  commentId: z.string().min(1),
});

export const CreateCommentSchema = z.object({
  text: z.string().min(1),
});

export const UpdateCommentSchema = z.object({
  text: z.string().min(1),
});
