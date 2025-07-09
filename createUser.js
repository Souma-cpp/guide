// createUser.js
import { v4 as uuidv4 } from "uuid";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  host: "localhost",
  user: "postgres",
  password: "postgresSQL#souma",
  database: "helper",
  port: 5432,
});

export async function createUser(email, name) {
  const userId = uuidv4();

  try {
    await pool.query(
      "INSERT INTO users (id, email, name) VALUES ($1, $2, $3)",
      [userId, email, name]
    );
    console.log("✅ User created successfully with ID:", userId);
    return userId;
  } catch (error) {
    console.error("❌ Error creating user:", error.message);
    throw error;
  }
}
