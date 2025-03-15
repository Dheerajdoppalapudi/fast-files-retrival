import express from "express";
import multer from "multer";
import path from "path";
import {
    saveFile,
    getFileVersions,
    getFileByVersion,
    rollbackFile,
    UPLOAD_DIR
} from "./../controllers/fileController.js";
import { authenticate } from './../middleware/authMiddleware.js'
import db from "./../models/db.js"
import fs from "fs";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/", async (req, res) => {
    try {
        const requestedPath = req.query.path || "";
        console.log("Requested Path: ", requestedPath);

        const absolutePath = path.join(UPLOAD_DIR, requestedPath);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ message: "Directory not found." });
        }

        // Get subdirectories from the filesystem
        const directories = fs.readdirSync(absolutePath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => ({
                filename: path.join(requestedPath, dirent.name),
                type: "folder"
            }));

        // Query files by directory field instead of filename LIKE
        const stmt = db.prepare("SELECT DISTINCT filename FROM files WHERE directory = ?");
        const files = stmt.all(requestedPath) || [];

        const fileList = files.map(file => {
            const versionsStmt = db.prepare(
                "SELECT id, version, uploaded_at FROM files WHERE filename = ? ORDER BY version DESC"
            );
            const versions = versionsStmt.all(file.filename);
            return {
                filename: file.filename,
                versions,
                type: "file"
            };
        });

        const response = [...directories, ...fileList];
        res.status(200).json(response);
    } catch (error) {
        console.error("Error fetching files:", error);
        res.status(500).json({ error: "Failed to retrieve files." });
    }
});


/**
 * @route POST /files/upload
 * @desc Upload a new file and handle versioning.
 * @access Private
 */
router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        const { directory } = req.body;
        console.log("Directory::", directory)
        const userId = 1;
        console.log("User ID: ", userId, "Directory:", directory);

        const result = await saveFile(req.file, userId, directory);
        res.status(201).json({ message: "File uploaded successfully.", data: result });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "File upload failed." });
    }
});

router.post("/create-directory", async (req, res) => {
    try {
        const { folderPath } = req.body;
        const fullPath = path.join(UPLOAD_DIR, folderPath);

        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            return res.status(201).json({ message: "Folder created successfully." });
        } else {
            return res.status(400).json({ error: "Folder already exists." });
        }
    } catch (error) {
        console.error("Error creating folder:", error);
        res.status(500).json({ error: "Folder creation failed." });
    }
});

/**
 * @route GET /files/versions/:filename
 * @desc Fetch all versions of a file.
 * @access Private
 */
router.get("/versions/:filename", authenticate, async (req, res) => {
    try {
        const { filename } = req.params;
        const versions = await getFileVersions(filename);

        if (versions.length === 0) {
            return res.status(404).json({ error: "No versions found for this file." });
        }

        res.status(200).json({ filename, versions });
    } catch (error) {
        console.error("Error fetching file versions:", error);
        res.status(500).json({ error: "Failed to fetch file versions." });
    }
});

/**
 * @route GET /files/:filename/version/:version
 * @desc Retrieve a specific version of a file.
 * @access Private
 */
router.get("/:filename/version/:version", authenticate, async (req, res) => {
    try {
        const { filename, version } = req.params;
        const file = await getFileByVersion(filename, Number(version));

        if (!file) {
            return res.status(404).json({ error: "File version not found." });
        }

        res.download(file.filepath, file.filename);
    } catch (error) {
        console.error("Error fetching file:", error);
        res.status(500).json({ error: "Failed to retrieve file." });
    }
});

/**
 * @route POST /files/rollback
 * @desc Rollback a file to a previous version.
 * @access Private (Editor/Admin roles required)
 */
router.post("/rollback", authenticate, async (req, res) => {
    try {
        const { filename, version } = req.body;
        const userId = req.user.id;

        if (!filename || !version) {
            return res.status(400).json({ error: "Filename and version are required." });
        }

        const result = await rollbackFile(filename, Number(version), userId);
        res.status(200).json({ message: "File rolled back successfully.", data: result });
    } catch (error) {
        console.error("Rollback error:", error);
        res.status(500).json({ error: "File rollback failed." });
    }
});

export default router;