import { Router } from "express";
import passport from "../middlewares/passport";
import { AuthController } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  GoogleIdTokenSchema,
} from "../validators/auth.validators";

const router = Router();

router.post("/register", validate({ body: RegisterSchema }), asyncHandler(AuthController.register));
router.post("/login", validate({ body: LoginSchema }), asyncHandler(AuthController.login));
router.post("/refresh-token", validate({ body: RefreshTokenSchema }), asyncHandler(AuthController.refreshToken));
router.post("/forgot-password", validate({ body: ForgotPasswordSchema }), asyncHandler(AuthController.forgotPassword));
router.post("/reset-password", validate({ body: ResetPasswordSchema }), asyncHandler(AuthController.resetPassword));

router.post("/logout", requireAuth, asyncHandler(AuthController.logout));

router.post(
  "/login/google/android",
  validate({ body: GoogleIdTokenSchema }),
  asyncHandler(AuthController.loginWithGoogleAndroid)
);

router.get(
  "/login/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

router.get(
  "/login/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/auth/login/google/failed",
  }),
  asyncHandler(AuthController.handleGoogleCallback)
);

router.get("/login/google/failed", (_req, res) => {
  res.status(401).json({ message: "Google login failed" });
});

export default router;
