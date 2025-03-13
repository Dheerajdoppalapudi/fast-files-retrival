import React from "react";
import { List, Typography, Space, Tag, Button } from "antd";
import { 
  FolderOutlined, 
  FileOutlined
} from "@ant-design/icons";

const { Text } = Typography;

const FileList = ({ files, onNavigate }) => {
  return (
    <List
      size="small"
      className="file-list"
      itemLayout="vertical"
      dataSource={files}
      renderItem={([name, content]) => (
        <List.Item 
          style={{ 
            padding: "8px 12px", 
            borderRadius: "4px",
            marginBottom: "4px",
            backgroundColor: "#fafafa",
            transition: "all 0.2s"
          }}
        >
          {Array.isArray(content) ? (
            <div style={{ width: "100%" }}>
              <Space align="center">
                <FileOutlined style={{ color: "#1890ff" }} />
                <Text strong>{name}</Text>
              </Space>
              
              <div style={{ 
                marginLeft: "24px", 
                borderLeft: "1px dashed #e8e8e8",
                paddingLeft: "12px",
                marginTop: "4px"
              }}>
                {content.map((version, index) => (
                  <div key={version.versionId} style={{ margin: "2px 0", display: "flex", alignItems: "center" }}>
                    <a 
                      href={version.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ marginRight: "8px" }}
                    >
                      {version.isLatest ? (
                        <Tag color="blue" style={{ margin: 0, padding: "0 4px" }}>Latest</Tag>
                      ) : (
                        <Tag style={{ margin: 0, padding: "0 4px" }}>version {content.length - index}</Tag>
                      )}
                    </a>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Last modified: {new Date(version.lastModified).toLocaleDateString()}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Button 
              type="text" 
              onClick={() => onNavigate(name)} 
              icon={<FolderOutlined style={{ color: "#1890ff" }} />}
              style={{ padding: "0px 4px" }}
            >
              {name}
            </Button>
          )}
        </List.Item>
      )}
    />
  );
};

export default FileList;