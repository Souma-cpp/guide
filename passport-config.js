import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import sql from "./db.js"; // ✅ Supabase or Render DB connection

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "http://localhost:3000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("✅ Google Profile:", profile);

        const email = profile.emails[0].value;
        const name = profile.displayName;
        const avatar = profile.photos[0].value;

        const result = await sql`SELECT * FROM users WHERE email = ${email}`;

        if (result.length > 0) {
          const user = result[0];
          return done(null, {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar,
          });
        } else {
          const newUser = await sql`
            INSERT INTO users (id, name, email)
            VALUES (gen_random_uuid(), ${name}, ${email})
            RETURNING *
          `;

          return done(null, {
            id: newUser[0].id,
            name: newUser[0].name,
            email: newUser[0].email,
            avatar,
          });
        }
      } catch (err) {
        console.error("❌ Google Auth Error:", err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

export default passport;
