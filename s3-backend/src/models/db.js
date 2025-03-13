import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

// Convert `import.meta.url` to directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFilePath = process.env.DB_FILE || "database.sqlite";
const db = new Database(dbFilePath, { verbose: console.log });

// Enable foreign keys
db.exec("PRAGMA foreign_keys = ON;");

// Read and execute schema file
const schemaPath = path.join(__dirname, "schema.sql");
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);
  console.log("✅ Database initialized successfully.");
} else {
  console.error("❌ Error: schema.sql file not found!");
}

export default db;
