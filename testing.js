import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const api_key = process.env.YT_API_KEY;
const search_for = "machine learning";

const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(
  search_for
)}&maxResults=5&key=${api_key}`;

axios
  .get(url)
  .then((res) => {
    console.log("✅ Video Results:", res.data.items);
  })
  .catch((err) => {
    console.error("❌ API Error:", err.message);
  });
