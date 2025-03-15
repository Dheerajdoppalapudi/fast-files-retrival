import React, { useState } from "react";
import axios from "axios";
import { Upload, Button, Typography, Space, Alert } from "antd";
import { UploadOutlined, FileOutlined, CheckCircleOutlined } from "@ant-design/icons";

const { Text, Link, Title } = Typography;

const UploadFile = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState("");

  const handleFileSelect = ({ fileList }) => {
    setFile(fileList.length > 0 ? fileList[fileList.length - 1].originFileObj : null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data } = await axios.post("http://localhost:8000/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setFileUrl(data.fileUrl);
    } catch (error) {
      console.error("❌ Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="small">
      <Title level={4}>Upload File</Title>

      <Upload beforeUpload={() => false} onChange={handleFileSelect} maxCount={1} showUploadList onRemove={() => setFile(null)}>
        <Button icon={<UploadOutlined />}>Select File</Button>
      </Upload>

      <Button
        type="primary"
        onClick={handleUpload}
        disabled={!file || uploading}
        loading={uploading}
        style={{ marginTop: "8px" }}
      >
        {uploading ? "Uploading..." : "Upload"}
      </Button>

      {fileUrl && (
        <Alert
          message="Upload Successful"
          description={
            <Space direction="vertical">
              <Text>File URL:</Text>
              <Space>
                <FileOutlined />
                <Link href={fileUrl} target="_blank" rel="noopener noreferrer" ellipsis>
                  {fileUrl}
                </Link>
              </Space>
            </Space>
          }
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginTop: "16px" }}
        />
      )}
    </Space>
  );
};

export default UploadFile;