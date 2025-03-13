import { PutObjectCommand, ListObjectVersionsCommand, GetObjectCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import s3 from "../config/s3Config.js";
import streamToString from "../utils/streamToString.js";

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const bucketName = process.env.AWS_BUCKET_NAME;
    if (!bucketName) return res.status(500).json({ success: false, message: "Bucket name not configured" });

    const uploadParams = {
      Bucket: bucketName,
      Key: req.file.originalname,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    await s3.send(new PutObjectCommand(uploadParams));

    res.json({
      success: true,
      message: "File uploaded successfully",
      fileUrl: `https://${bucketName}.s3.amazonaws.com/${req.file.originalname}`,
    });

  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getFileList = async (req, res) => {
  try {
    const bucketName = process.env.AWS_BUCKET_NAME;
    const command = new ListObjectVersionsCommand({ Bucket: bucketName });
    const response = await s3.send(command);

    if (!response.Versions) return res.json({ success: true, files: {} });

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
};

export const getFileContent = async (req, res) => {
  const { key, versionId } = req.query;
  const bucketName = process.env.AWS_BUCKET_NAME;

  if (!key || !versionId) {
    return res.status(400).json({ success: false, message: "Missing key or versionId" });
  }

  try {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key, VersionId: versionId });
    const response = await s3.send(command);
    const content = await streamToString(response.Body);

    res.json({ success: true, content });
  } catch (error) {
    console.error("Error fetching file content:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const compareFiles = async (req, res) => {
  const { key, versionId1, versionId2 } = req.query;
  const bucketName = process.env.AWS_BUCKET_NAME;

  if (!key || !versionId1 || !versionId2) {
    return res.status(400).json({ success: false, message: "Missing key or versionId" });
  }

  try {
    const getFileContent = async (versionId) => {
      const command = new GetObjectCommand({ Bucket: bucketName, Key: key, VersionId: versionId });
      const response = await s3.send(command);
      return await streamToString(response.Body);
    };

    const [content1, content2] = await Promise.all([getFileContent(versionId1), getFileContent(versionId2)]);

    res.json({
      success: true,
      message: content1 === content2 ? "Files are identical" : "Files are different",
    });

  } catch (error) {
    console.error("Error comparing files:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const testS3 = async (req, res) => {
  try {
    const data = await s3.send(new ListBucketsCommand({}));
    res.json({ success: true, buckets: data.Buckets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
