import { Router } from "express";
import passport from "../middlewares/passport";
import { AuthController } from "../controllers/auth.controller";
import { isAuthorized } from "../middlewares/authorization";
import { validate } from "../middlewares/validate";
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from "../validators/auth.validators";

const router = Router();

router.post("/register", validate({ body: RegisterSchema }), AuthController.register);
router.post("/login", validate({ body: LoginSchema }), AuthController.login);
router.post("/refresh-token", validate({ body: RefreshTokenSchema }), AuthController.refreshToken);
router.post("/forgot-password", validate({ body: ForgotPasswordSchema }), AuthController.forgotPassword);
router.post("/reset-password", validate({ body: ResetPasswordSchema }), AuthController.resetPassword);

router.post("/logout", isAuthorized, AuthController.logout);

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
  AuthController.handleGoogleCallback
);

router.get("/login/google/failed", (_req, res) => {
  res.status(401).json({ message: "Google login failed" });
});

export default router;
