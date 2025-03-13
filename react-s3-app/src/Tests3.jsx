import React, { useEffect } from "react";

const testS3Connection = async () => {
  try {
    const response = await fetch("http://localhost:8000/files/test-s3");
    const data = await response.json();
    console.log("✅ S3 Connection Successful! Buckets:", data);
  } catch (error) {
    console.error("❌ S3 Connection Failed:", error);
  }
};


export default testS3Connection;