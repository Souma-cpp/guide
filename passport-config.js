import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
dotenv.config();

import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "helper",
  password: process.env.DBPASSWORD,
  port: 5432,
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const avatar = profile.photos[0].value; // ✅ get Google profile image

        const result = await pool.query(
          "SELECT * FROM users WHERE email = $1",
          [email]
        );

        if (result.rows.length > 0) {
          const user = result.rows[0];
          return done(null, {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar, // ✅ pass avatar for session
          });
        } else {
          const newUser = await pool.query(
            "INSERT INTO users (id, name, email) VALUES (gen_random_uuid(), $1, $2) RETURNING *",
            [name, email]
          );
          return done(null, {
            id: newUser.rows[0].id,
            name: newUser.rows[0].name,
            email: newUser.rows[0].email,
            avatar, // ✅ pass avatar
          });
        }
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user); // ✅ Pass whole object including avatar
});

passport.deserializeUser((user, done) => {
  done(null, user); // ✅ Skip DB lookup, trust session content
});

export default passport;
