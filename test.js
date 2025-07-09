import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);

const testConnection = async () => {
  try {
    const result = await sql`SELECT NOW()`;
    console.log("✅ Connected to Supabase. Current time:", result[0].now);
  } catch (error) {
    console.error("❌ Database connection failed:", error);
  }
};

testConnection();
