import { Router } from "express";
import passport from "../middlewares/passport";
import { AuthController } from "../controllers/auth.controller";
import { isAuthorized } from "../middlewares/authorization";

const router = Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/refresh-token", AuthController.refreshToken);

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
