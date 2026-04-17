import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.email(),
  password: z.string().min(6).max(32),
  userName: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_.-]+$/, "userName may only contain letters, digits, underscores, dots, or hyphens")
    .optional(),
  displayName: z.string().min(1).max(32).optional(),
  profileImage: z.url().optional(),
});

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const ForgotPasswordSchema = z.object({
  email: z.email(),
});

export const ResetPasswordSchema = z.object({
  email: z.email(),
  code: z.string().length(6),
  newPassword: z.string().min(6).max(128),
});
