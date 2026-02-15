import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

const clientID = process.env.OAUTH_CLIENT_ID;
const clientSecret = process.env.OAUTH_CLIENT_SECRET;
const callbackURL = process.env.OAUTH_CALLBACK_URL;

if (!clientID || !clientSecret || !callbackURL) {
  throw new Error(
    "Missing Google OAuth env vars: OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET / OAUTH_CALLBACK_URL"
  );
}

passport.use(
  new GoogleStrategy(
    { clientID, clientSecret, callbackURL },
    async (_accessToken, _refreshToken, profile, done) => {
      const user = {
        email: profile.emails?.[0]?.value || "",
        userName: profile.displayName || "",
        profileImage: profile.photos?.[0]?.value || "",
      };

      return done(null, user);
    }
  )
);

export default passport;
