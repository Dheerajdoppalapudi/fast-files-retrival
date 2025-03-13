import React, { useState } from "react";
import axios from "axios";
import { 
  Upload, 
  Button, 
  Typography, 
  Space, 
  Alert 
} from "antd";
import { 
  UploadOutlined, 
  FileOutlined, 
  CheckCircleOutlined 
} from "@ant-design/icons";

const { Text, Link, Title } = Typography;

const UploadFile = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState("");

  const handleFileSelect = (info) => {
    // Only keep the latest file
    if (info.fileList && info.fileList.length > 0) {
      const latestFile = info.fileList[info.fileList.length - 1];
      setFile(latestFile.originFileObj);
    } else {
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("http://localhost:8000/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("✅ Upload successful!", response.data);
      setFileUrl(response.data.fileUrl);
    } catch (error) {
      console.error("❌ Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const uploadProps = {
    beforeUpload: () => false, // Prevent auto upload
    onChange: handleFileSelect,
    maxCount: 1,
    showUploadList: true,
    onRemove: () => setFile(null)
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="small">
      <Title level={4} style={{ margin: "0 0 16px 0" }}>Upload File to AWS S3</Title>
      
      <Space direction="vertical" style={{ width: "100%" }}>
        <Upload {...uploadProps}>
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
      </Space>
      
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