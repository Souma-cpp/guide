// ✅ UPDATED: YouTube Recommendation App (Now Uses Supabase + postgres.js)

import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "./passport-config.js";
import cookieParser from "cookie-parser";
import sql from "./db.js"; // ✅ Supabase connection

dotenv.config();
const app = express();
const port = 3000;
const api_key = process.env.YT_API_KEY;
const saltRounds = 10;
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "session",
    }),
    secret: process.env.SESSION_SECRET || "jessiePinkman",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.searchCount = req.session.searchCount || 1;
  next();
});

app.get("/", (req, res) => {
  res.render("home", { user: req.session.user });
});

app.get("/login", (req, res) => res.render("login", { error: null }));
app.get("/register", (req, res) => res.render("register", { error: null }));

app.post("/result", async (req, res) => {
  const topic = req.body.topic.trim().toLowerCase();

  if (!req.session.user) {
    req.session.searchCount = (req.session.searchCount || 0) + 1;
    if (req.session.searchCount > 2) return res.redirect("/login");
  }

  try {
    const cached = await sql`
      SELECT * FROM search_cache WHERE topic = ${topic}
    `;

    if (cached.length > 0) {
      let videos;
      try {
        videos = JSON.parse(cached[0].videos);
      } catch (err) {
        console.warn("Failed to parse cached video data.");
      }
      if (videos) {
        return res.render("result", {
          videos,
          topic,
          user: req.session.user,
          searchCount: req.session.searchCount,
        });
      }
    }

    const searchRes = await axios.get(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(
        topic + " tutorial OR course -shorts -funny -meme"
      )}&videoDuration=long&order=viewCount&maxResults=10&key=${api_key}`
    );

    const videoIds = searchRes.data.items
      .map((item) => item.id.videoId)
      .join(",");
    const statsRes = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${api_key}`
    );

    const topicRegex = new RegExp(`\\b${topic}\\b`, "i");

    const videos = statsRes.data.items
      .map((video) => {
        const title = video.snippet.title;
        const description = video.snippet.description || "";
        if (!topicRegex.test(title) && !topicRegex.test(description))
          return null;
        const likes = parseInt(video.statistics.likeCount || "0");
        const views = parseInt(video.statistics.viewCount || "0");
        const comments = parseInt(video.statistics.commentCount || "0");
        const rawScore = likes * 3 + comments * 2 + views / 1000;
        const score = Math.log10(rawScore + 1);
        return {
          title,
          description,
          thumbnail: video.snippet.thumbnails.high.url,
          videoId: video.id,
          views,
          likes,
          commentCount: comments,
          score,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    await sql`
      INSERT INTO search_cache(topic, videos)
      VALUES(${topic}, ${JSON.stringify(videos)})
      ON CONFLICT (topic) DO UPDATE SET videos = EXCLUDED.videos
    `;

    res.render("result", {
      videos,
      topic,
      user: req.session.user,
      searchCount: req.session.searchCount,
    });
  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).send("Something went wrong");
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (!result.length)
      return res.render("login", { error: "Invalid credentials" });
    const user = result[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render("login", { error: "Invalid credentials" });
    req.session.user = { id: user.id, name: user.name, email: user.email };
    res.redirect("/");
  } catch (err) {
    console.error("Login error:", err.message);
    res.render("login", { error: "Something went wrong" });
  }
});

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, saltRounds);
    const result = await sql`
      INSERT INTO users (id, name, email, password)
      VALUES (${uuidv4()}, ${name}, ${email}, ${hashed}) RETURNING *
    `;
    const user = result[0];
    req.session.user = { id: user.id, name: user.name, email: user.email };
    res.redirect("/");
  } catch (err) {
    console.error("Register error:", err.message);
    res.render("register", {
      error: "User with this email may already exist.",
    });
  }
});

app.get("/video/:id", async (req, res) => {
  const videoId = req.params.id;
  try {
    const statsRes = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${api_key}`
    );
    const video = statsRes.data.items[0];
    const channelId = video.snippet.channelId;
    const channelRes = await axios.get(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${api_key}`
    );
    const channel = channelRes.data.items[0];
    res.render("video", {
      video: {
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnail: video.snippet.thumbnails.high.url,
        views: video.statistics.viewCount,
        likes: video.statistics.likeCount,
        commentCount: video.statistics.commentCount,
        publishedAt: video.snippet.publishedAt,
        channelTitle: video.snippet.channelTitle,
        videoId,
        channelDescription: channel.snippet.description,
      },
      comments: [],
    });
  } catch (err) {
    console.error("Video error:", err.message);
    res.status(500).send("Video not found");
  }
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    req.session.user = req.user;
    res.redirect("/");
  }
);

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).send("Could not log out");
    }
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

app.get(["/profile", "/my-searches", "/settings"], (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("feature", {
    title: "Coming Soon",
    message:
      "Hey, I know you wanted to check out this feature, but I'm still working on it. Soon you'll get it 😄",
  });
});

app.get("/learn-more", (req, res) =>
  res.render("learn-more", { user: req.session.user || null })
);
app.get("/privacy", (req, res) =>
  res.render("privacy", { user: req.session.user || null })
);
app.get("/terms", (req, res) =>
  res.render("terms", { user: req.session.user || null })
);

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
