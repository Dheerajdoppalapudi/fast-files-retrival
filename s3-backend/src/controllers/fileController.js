import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "./../models/db.js"
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOAD_DIR = path.join(__dirname, "uploads");
export const VERSION_DIR = path.join(__dirname, "uploads", "versions");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(VERSION_DIR)) fs.mkdirSync(VERSION_DIR, { recursive: true });

/**
 * Save a new file upload and handle versioning.
 * @param {Object} file - The uploaded file object (req.file).
 * @param {number} userId - The ID of the user uploading the file.
 * @returns {Object} - The file name and new version.
 */
export const saveFile = async (file, userId, directory = "") => {
    try {
        // Create the main upload directory if it doesn't exist
        const folderPath = path.join(UPLOAD_DIR, directory);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        // Create the version directory structure
        const versionFolderPath = path.join(VERSION_DIR, directory);
        if (!fs.existsSync(versionFolderPath)) {
            fs.mkdirSync(versionFolderPath, { recursive: true });
        }

        const filePath = path.join(folderPath, file.originalname);

        // Check if the file already exists
        if (fs.existsSync(filePath)) {
            // Get the current version from the database
            const row = db.prepare(
                "SELECT version FROM files WHERE filename = ? AND directory = ? ORDER BY version DESC LIMIT 1"
            ).get(file.originalname, directory);

            let newVersion = row ? row.version + 1 : 1;
            const previousVersion = row ? row.version : 0;

            // Create the version backup file path
            const oldVersionPath = path.join(versionFolderPath, `${file.originalname}_v${previousVersion}`);
            
            // Copy the existing file to the version directory
            fs.copyFileSync(filePath, oldVersionPath);
            
            // Write the new file
            fs.writeFileSync(filePath, file.buffer);

            // Insert file metadata into SQLite database
            const stmt = db.prepare(
                "INSERT INTO files (filename, filepath, version, user_id, directory) VALUES (?, ?, ?, ?, ?)"
            );
            stmt.run(file.originalname, filePath, newVersion, userId, directory);

            return { filename: file.originalname, version: newVersion, directory };
        } else {
            // First-time save
            fs.writeFileSync(filePath, file.buffer);

            const stmt = db.prepare(
                "INSERT INTO files (filename, filepath, version, user_id, directory) VALUES (?, ?, ?, ?, ?)"
            );
            stmt.run(file.originalname, filePath, 1, userId, directory);

            return { filename: file.originalname, version: 1, directory };
        }
    } catch (err) {
        console.error("Error saving file:", err);
        throw new Error("File upload failed: " + err.message);
    }
};


// Route to create a directory


/**
 * Get all file versions for a given filename.
 * @param {string} filename - The name of the file.
 * @returns {Array} - List of file versions with metadata.
 */
export const getFileVersions = async (filename) => {
    try {
        const stmt = db.prepare(
            "SELECT id, filename, filepath, version, uploaded_at FROM files WHERE filename = ? ORDER BY version DESC"
        );
        return stmt.all(filename);
    } catch (err) {
        console.error("Error fetching file versions:", err);
        throw new Error("Could not retrieve file versions.");
    }
};

/**
 * Get a specific version of a file.
 * @param {string} filename - The file name.
 * @param {number} version - The version number.
 * @returns {Object} - File path and metadata.
 */
export const getFileByVersion = async (filename, version) => {
    try {
        const stmt = db.prepare(
            "SELECT filename, filepath, version FROM files WHERE filename = ? AND version = ?"
        );
        const file = stmt.get(filename, version);

        if (!file) {
            throw new Error("File version not found.");
        }

        return file;
    } catch (err) {
        console.error("Error fetching file:", err);
        throw new Error("Could not retrieve file.");
    }
};

/**
 * Rollback a file to a previous version.
 * @param {string} filename - The file name.
 * @param {number} version - The version to restore.
 * @param {number} userId - The ID of the user performing the rollback.
 * @returns {Object} - Restored file details.
 */
export const rollbackFile = async (filename, version, userId) => {
    try {
        const file = await getFileByVersion(filename, version);
        const latestVersionPath = path.join(UPLOAD_DIR, filename);
        const versionedFilePath = path.join(VERSION_DIR, `${filename}_v${version}`);

        if (!fs.existsSync(versionedFilePath)) {
            throw new Error("Version file does not exist.");
        }

        // Move the selected version back to the main directory
        fs.copyFileSync(versionedFilePath, latestVersionPath);

        // Insert rollback action as a new version
        const newVersion = version + 1;
        const stmt = db.prepare(
            "INSERT INTO files (filename, filepath, version, user_id) VALUES (?, ?, ?, ?)"
        );
        stmt.run(filename, latestVersionPath, newVersion, userId);

        return { filename, restoredVersion: version, newVersion };
    } catch (err) {
        console.error("Error rolling back file:", err);
        throw new Error("Rollback failed.");
    }
};