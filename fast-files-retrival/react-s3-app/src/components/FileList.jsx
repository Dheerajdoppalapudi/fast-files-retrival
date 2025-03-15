import React, { useState } from "react";
import { List, Typography, Space, Tag } from "antd";
import { FolderOutlined, FileTextOutlined, ArrowRightOutlined } from "@ant-design/icons";

const { Text } = Typography;

const FileList = ({ files, onNavigate, onVersionClick }) => {
  const [expandedFiles, setExpandedFiles] = useState({});

  const toggleVersions = (fileName) => {
    setExpandedFiles((prev) => ({
      ...prev,
      [fileName]: !prev[fileName],
    }));
  };

  return (
    <List
      itemLayout="vertical"
      dataSource={files}
      renderItem={([name, content]) => (
        <List.Item
          style={{
            padding: "10px 16px",
            transition: "background 0.2s",
            // cursor: content.versions ? "default" : "pointer",
            borderRadius: "6px",
            background: "transparent",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          onClick={() =>
            typeof content === "object" && !content.versions ? onNavigate(name) : null
          }
        >
          {/* File/Folder Row */}
          <Space size="middle" style={{ width: "100%", display: "flex", alignItems: "center" }}>
            {content?.versions ? (
              <FileTextOutlined style={{ fontSize: 18, color: "#1890ff" }} />
            ) : (
              <FolderOutlined style={{ fontSize: 18, color: "#faad14" }} />
            )}

            <Text strong>{name}</Text>

            {/* Tag for Number of Versions */}
            {content?.versions && (
              <Tag
                color="blue"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVersions(name);
                }}
              >
                {content.versions.length} Versions
              </Tag>
            )}
          </Space>

          {/* Versions List - Now properly aligned underneath */}
          {expandedFiles[name] && content?.versions && (
            <div style={{ marginTop: 8, paddingLeft: 32, width: "100%" }}>
              {content.versions.map((version, index) => (
                <div
                  key={version.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    padding: "4px 0",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onVersionClick(version);
                  }}
                >

                  <ArrowRightOutlined style={{ color: "#1890ff", marginRight: 8 }} />
                  <Text type="secondary">
                    version {version.version} - date modified: {new Date(version.uploaded_at).toLocaleString()}
                  </Text>
                </div>
              ))}
            </div>
          )}
        </List.Item>
      )}
    />
  );
};

export default FileList;
