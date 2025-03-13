import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import { uploadFile, getFileList, getFileContent, compareFiles, testS3 } from "../controllers/fileController.js";

const router = express.Router();

router.post("/upload", upload.single("file"), uploadFile);
router.get("/", getFileList);
router.get("/content", getFileContent);
router.get("/compare", compareFiles);
router.get("/test-s3", testS3);

export default router;
