import express from "express";
// import upload from "../middleware/uploadMiddleware.js";
import multer from "multer";
import sqlite3 from "sqlite3";
import { uploadFile, getFileList, getFileContent, compareFiles, testS3 } from "../controllers/fileController.js";

const router = express.Router();
const db = new sqlite3.Database("./database.sqlite");
const storage = multer.memoryStorage();
const upload = multer({ storage });


router.post("/upload", upload.single("file"), uploadFile);
router.get("/", getFileList);
router.get("/content", getFileContent);
router.get("/compare", compareFiles);
router.get("/test-s3", testS3);

router.get("/pending-files/:userId", (req, res) => {
    const { userId } = req.params;

    db.all(
        `SELECT f.id, f.filename, f.status, f.uploaded_by, f.group_id, g.name AS group_name 
       FROM files f
       JOIN groups g ON f.group_id = g.id
       JOIN user_groups ug ON g.id = ug.group_id
       WHERE ug.user_id = ? AND f.status = 'pending'`,
        [userId],
        (err, rows) => {
            if (err) {
                console.error("Failed to fetch pending files:", err);
                return res.status(500).json({ error: "Internal Server Error" });
            }
            res.json(rows);
        }
    );
});

router.patch("/approve/:id", (req, res) => {
    const { id } = req.params;

    db.run(`UPDATE files SET status = 'approved' WHERE id = ?`, [id], function (err) {
        if (err) {
            console.error("Approval failed:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
        res.json({ success: true, message: "File approved" });
    });
});

router.patch("/reject/:id", (req, res) => {
    const { id } = req.params;

    db.run(`UPDATE files SET status = 'rejected' WHERE id = ?`, [id], function (err) {
        if (err) {
            console.error("Rejection failed:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
        res.json({ success: true, message: "File rejected" });
    });
});

export default router;