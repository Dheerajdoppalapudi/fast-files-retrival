import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { S3Client, PutObjectCommand, ListBucketsCommand, ListObjectVersionsCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";
import stream from "stream";
import { promisify } from "util";
import authRoutes from "./src/routes/authRoutes.js";


dotenv.config();
const pipeline = promisify(stream.pipeline);
const app = express();
const corsOptions = {
  origin: "http://localhost:5173",
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type,Authorization",
};

app.use(cors(corsOptions));
app.use(express.json());
app.use("/auth", authRoutes);

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const upload = multer({ storage: multer.memoryStorage() });

const streamToString = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
};

app.get("/compare-files", async (req, res) => {
  const { key, versionId1, versionId2 } = req.query;
  const bucketName = process.env.AWS_BUCKET_NAME;

  if (!key || !versionId1 || !versionId2) {
    return res.status(400).json({ success: false, message: "Missing key or versionId" });
  }

  try {
    const getFileContent = async (versionId) => {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
        VersionId: versionId,
      });
      const response = await s3.send(command);
      return await streamToString(response.Body);
    };

    const [content1, content2] = await Promise.all([
      getFileContent(versionId1),
      getFileContent(versionId2),
    ]);

    if (content1 === content2) {
      res.json({ success: true, message: "Files are identical", differences: null });
    } else {
      res.json({ success: true, message: "Files are different", differences: diff(content1, content2) });
    }
  } catch (error) {
    console.error("Error comparing files:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/file-content", async (req, res) => {
  const { key, versionId } = req.query;
  const bucketName = process.env.AWS_BUCKET_NAME;

  if (!key || !versionId) {
    return res.status(400).json({ success: false, message: "Missing key or versionId" });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
      VersionId: versionId,
    });

    const response = await s3.send(command);
    const content = await streamToString(response.Body);

    res.json({ success: true, content });
  } catch (error) {
    console.error("Error fetching file content:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/test-s3", async (req, res) => {
  try {
    const data = await s3.send(new ListBucketsCommand({}));
    res.json({ success: true, buckets: data.Buckets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const bucketName = process.env.AWS_BUCKET_NAME;
    console.log("Bucket name: ", bucketName)
    if (!bucketName) {
      return res.status(500).json({ success: false, message: "Bucket name not configured" });
    }

    const uploadParams = {
      Bucket: bucketName,
      Key: req.file.originalname,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    // console.log("Uploading File: ", uploadParams);

    const command = new PutObjectCommand(uploadParams);
    console.log("Command: ", command)
    await s3.send(command);

    res.json({
      success: true,
      message: "File uploaded successfully",
      fileUrl: `https://${bucketName}.s3.amazonaws.com/${req.file.originalname}`,
    });

  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/app", (req, res) => {
  res.json({ message: "Server is working" });
});

app.get("/files", async (req, res) => {
  try {
    const bucketName = process.env.AWS_BUCKET_NAME;
    const command = new ListObjectVersionsCommand({ Bucket: bucketName });
    const response = await s3.send(command);

    if (!response.Versions) {
      return res.json({ success: true, files: {} });
    }

    const files = {};

    response.Versions.forEach((file) => {
      const parts = file.Key.split("/");
      let currentLevel = files;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!currentLevel[part]) {
          currentLevel[part] = i === parts.length - 1 ? [] : {}; 
        }
        if (i === parts.length - 1) {
          currentLevel[part].push({
            versionId: file.VersionId,
            lastModified: file.LastModified,
            isLatest: file.IsLatest,
            fileUrl: `https://${bucketName}.s3.amazonaws.com/${file.Key}?versionId=${file.VersionId}`,
          });
        } else {
          currentLevel = currentLevel[part];
        }
      }
    });

    res.json({ success: true, files });
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));