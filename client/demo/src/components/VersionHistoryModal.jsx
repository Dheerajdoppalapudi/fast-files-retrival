import React from "react";
import { Modal, Timeline, Button, Space, Typography, Tag, Tooltip, theme, Spin, Skeleton, Row, Col } from "antd";
import {
  EyeOutlined,
  DownloadOutlined,
  RollbackOutlined,
  CloseOutlined,
  CheckOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import api from "../utils/api";
import { blobToText, extractText, formatFileSize } from "../utils/fileUtils";
import DiffMatchPatch from "diff-match-patch";
import { useMediaQuery } from 'react-responsive';

const { Text, Title } = Typography;

// FileViewer Component for displaying a single file
const FileViewer = ({ content, loading }) => {
  const { token } = theme.useToken();
  
  if (loading) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }
  
  return (
    <div
      style={{
        background: token.colorBgContainer,
        padding: "15px",
        borderRadius: "8px",
        color: token.colorTextBase,
        fontSize: "16px",
        lineHeight: "1.5",
        wordWrap: "break-word",
        width: "100%",
        height: "100%",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        overflowY: "auto",
        overflowX: "hidden",
        
        // Hide scrollbar by default
        scrollbarWidth: "none", // Firefox
        msOverflowStyle: "none", // IE and Edge
        "&::-webkit-scrollbar": {
          width: "6px", // Thin scrollbar
          height: "6px" // Optional for horizontal scrollbar
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: token.colorBorder, // Customize thumb color
          borderRadius: "10px"
        },
        "&::-webkit-scrollbar-track": {
          backgroundColor: "transparent" // Make track invisible
        },
      
        // Show scrollbar when hovering
        ":hover": {
          overflowY: "scroll", // Enable scrollbar on hover
          "&::-webkit-scrollbar": {
            opacity: 1,
          }
        }
      }}
    >
      <pre style={{ whiteSpace: "pre-wrap" }}>{content}</pre>
    </div>
  );
};

// FileComparison Component
const FileComparison = ({ oldContent, newContent, loading }) => {
  const { token } = theme.useToken();
  const [diffResult, setDiffResult] = React.useState("");

  React.useEffect(() => {
    if (oldContent && newContent) {
      const dmp = new DiffMatchPatch();
      const diff = dmp.diff_main(oldContent, newContent);
      dmp.diff_cleanupSemantic(diff);
      setDiffResult(dmp.diff_prettyHtml(diff));
    }
  }, [oldContent, newContent]);

  if (loading) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  return (
    <div
      style={{
        background: token.colorBgContainer,
        padding: "15px",
        borderRadius: "8px",
        color: token.colorTextBase,
        width: "100%",
        height: "100%",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        overflowY: "auto",
        overflowX: "hidden",
        
        // Hide scrollbar by default
        scrollbarWidth: "none", // Firefox
        msOverflowStyle: "none", // IE and Edge
        "&::-webkit-scrollbar": {
          width: "6px", // Thin scrollbar
          height: "6px" // Optional for horizontal scrollbar
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: token.colorBorder, // Customize thumb color
          borderRadius: "10px"
        },
        "&::-webkit-scrollbar-track": {
          backgroundColor: "transparent" // Make track invisible
        },
      
        // Show scrollbar when hovering
        ":hover": {
          overflowY: "scroll", // Enable scrollbar on hover
          "&::-webkit-scrollbar": {
            opacity: 1,
          }
        }
      }}
    >
      <div
        dangerouslySetInnerHTML={{ __html: diffResult }}
        style={{
          
          background: token.colorBgContainer,
          padding: "0",
          color: token.colorTextBase,
          fontSize: "16px",
          wordWrap: "break-word",
          
        }}
      />
    </div>
  );
};

// VersionHistoryModal Component
const VersionHistoryModal = ({ visible, onClose, file, onrefersh }) => {
  const { token } = theme.useToken(); // Using theme tokens for dynamic styling
  const isMobile = useMediaQuery({ maxWidth: 768 });
  
  const [baseVersion, setBaseVersion] = React.useState(null);
  const [targetVersion, setTargetVersion] = React.useState(null);
  const [baseContent, setBaseContent] = React.useState("");
  const [targetContent, setTargetContent] = React.useState("");
  const [comparing, setComparing] = React.useState(false);
  const [baseLoading, setBaseLoading] = React.useState(false);
  const [targetLoading, setTargetLoading] = React.useState(false);

  // Use full screen when any panel is active
  const isFullScreen = React.useMemo(() => baseVersion !== null || targetVersion !== null, [baseVersion, targetVersion]);

  // Dynamically adjust modal width and height
  const width = React.useMemo(() => {
    if (isFullScreen) return "100vw";
    return 700;
  }, [isFullScreen]);

  const timelineWidth = React.useMemo(() => {
    if (baseVersion && targetVersion) return isMobile ? "30%" : "20%";
    if (baseVersion || targetVersion) return isMobile ? "30%" : "25%";
    return "100%";
  }, [baseVersion, targetVersion, isMobile]);

  const baseWidth = React.useMemo(() => {
    if (baseVersion && targetVersion) return isMobile ? "35%" : "40%";
    if (baseVersion) return isMobile ? "70%" : "75%";
    return "0%";
  }, [baseVersion, targetVersion, isMobile]);

  const targetWidth = React.useMemo(() => {
    if (baseVersion && targetVersion) return isMobile ? "35%" : "40%";
    if (targetVersion && !baseVersion) return isMobile ? "70%" : "75%";
    return "0%";
  }, [targetVersion, baseVersion, isMobile]);

  // Fetch file content when base or target version changes
  React.useEffect(() => {
    const fetchBaseContent = async () => {
      if (baseVersion) {
        setBaseLoading(true);
        try {
          const data = await fileview(baseVersion);
          if (data?.blob) {
            const text = await blobToText(data.blob, file?.name, baseVersion.id);
            setBaseContent(text);
          }
        } catch (error) {
          console.error("Error fetching base content:", error);
          setBaseContent("Error loading file");
        } finally {
          setBaseLoading(false);
        }
      } else {
        setBaseContent("");
      }
    };

    fetchBaseContent();
  }, [baseVersion]);

  React.useEffect(() => {
    const fetchTargetContent = async () => {
      if (targetVersion) {
        setTargetLoading(true);
        try {
          const data = await fileview(targetVersion);
          if (data?.blob) {
            const text = await blobToText(data.blob, file?.name, targetVersion.id);
            setTargetContent(text);
          }
        } catch (error) {
          console.error("Error fetching target content:", error);
          setTargetContent("Error loading file");
        } finally {
          setTargetLoading(false);
        }
      } else {
        setTargetContent("");
      }
    };

    fetchTargetContent();
  }, [targetVersion]);

  // Update comparing state when both base and target are selected
  React.useEffect(() => {
    setComparing(baseVersion !== null && targetVersion !== null);
  }, [baseVersion, targetVersion]);

  const handleViewClick = (version) => {
    if (!baseVersion) {
      setBaseVersion(version);
    } else if (!targetVersion && baseVersion !== version) {
      setTargetVersion(version);
    } else {
      if (baseVersion === version) {
        setBaseVersion(targetVersion);
        setTargetVersion(null);
      } else {
        setBaseVersion(version);
      }
    }
  };

  const versionApproved = async (version) => {
    try {
      await api.Versions().approveVersion({
        versionID: version.id,
      });
      if (onrefersh) {
        onrefersh();
      }
    } catch (error) {
      console.error("Error approving version:", error);
    }
  };

  const rejectApproved = async (version) => {
    try {
      await api.Versions().rejectVersion({
        versionID: version.id,
      });
      if (onrefersh) {
        onrefersh();
      }
    } catch (error) {
      console.error("Error rejecting version:", error);
    }
  };

  const fileview = async (version) => {
    const fileData = await api.Versions().getFileWithProgress({
      versionID: version.id,
      onProgress: (progress) => {
        console.log(`Download Progress: ${progress}%`);
      },
    });
    return fileData; // This now includes the blob response
  };

  const downloadFile = async (version) => {
    try {
      const fileData = await fileview(version);
      if (fileData?.blob) {
        const url = window.URL.createObjectURL(fileData.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file?.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        console.error("No file data received");
      }
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const deleteVersion = async (version) => {
    try {
      await api.Items().removeItem({
        itemID: file.id,
        versionID: version.id
      });
      if (onrefersh) {
        onrefersh();
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const renderActionButton = (icon, text, onClick, type = "default", disabled = false, danger=false) => {
    const smallicon = !isMobile && !baseVersion && !targetVersion;
    return (
      <Tooltip title={!smallicon ? text : ""} placement="top">
        <Button
          icon={icon}
          type={type}
          onClick={onClick}
          disabled={disabled}
          style={{ minWidth: isMobile ? "40px" : "auto" }}
          danger={danger}
        >
          {smallicon && text}
        </Button>
      </Tooltip>
    );
  };

  const timeline = (
    <div
    style={{
      width: timelineWidth,
      transition: "0.3s ease",
      height: isFullScreen ? "calc(100vh - 57px)" : "auto",
      borderRight: isFullScreen ? `1px solid ${token.colorBorder}` : "none",
      backgroundColor: token.colorBgElevated,
      overflowY: "auto",
      overflowX: "hidden",
      
      // Hide scrollbar by default
      scrollbarWidth: "none", // Firefox
      msOverflowStyle: "none", // IE and Edge
      "&::-webkit-scrollbar": {
        width: "6px", // Thin scrollbar
        height: "6px" // Optional for horizontal scrollbar
      },
      "&::-webkit-scrollbar-thumb": {
        backgroundColor: token.colorBorder, // Customize thumb color
        borderRadius: "10px"
      },
      "&::-webkit-scrollbar-track": {
        backgroundColor: "transparent" // Make track invisible
      },
    
      // Show scrollbar when hovering
      ":hover": {
        overflowY: "scroll", // Enable scrollbar on hover
        "&::-webkit-scrollbar": {
          opacity: 1,
        }
      }
    }}
    
    >
      <Timeline
        style={{
          padding: "16px",
        }}
      >
        {file?.versions?.map((version, index) => {
          const status = version.status === "approved";
          const isActive = baseVersion === version || targetVersion === version;
          const versionNumber = file?.versions.length - index;

          return (
            <Timeline.Item 
              key={index} 
              style={{paddingTop: 7, paddingBottom: 7}} 
              color={!status ? "red" : "green"}
            >
              <div
                style={{
                  backgroundColor: isActive ? token.colorPrimaryBg : token.colorBgContainer,
                  padding: "16px",
                  borderRadius: "8px",
                  border: `1px solid ${isActive ? token.colorPrimary : token.colorBorder}`,
                  marginBottom: "8px",
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                  boxShadow: isActive ? `0 2px 8px ${token.colorPrimaryBgHover}` : "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                {/* Version Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <Text strong style={{ 
                    color: token.colorTextBase, 
                    fontSize: isMobile ? "14px" : "16px",
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}>
                    {`Version ${versionNumber} `}
                    {status ? (
                      <Tag color="green" style={{ marginLeft: 4 }}>{version.status}</Tag>
                    ) : (
                      <Tag color="red" style={{ marginLeft: 4 }}>{version.status}</Tag>
                    )}
                  </Text>
                  {!isMobile && (
                    <Text style={{ color: token.colorTextSecondary, fontSize: "14px" }}>
                      {new Date(version.created_at).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </Text>
                  )}
                </div>

                {/* Version Details */}
                <div style={{ marginBottom: "12px" }}>
                  <Text style={{ 
                    color: token.colorTextSecondary, 
                    fontSize: isMobile ? "12px" : "14px",
                    display: "block",
                  }}>
                    Size: {formatFileSize(version.size)} • Modified by: {version.uploader}
                  </Text>
                  {isMobile && (
                    <Text style={{ color: token.colorTextSecondary, fontSize: "12px" }}>
                      {new Date(version.created_at).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  )}
                </div>

                {/* Version Notes - with text truncation */}
                <div style={{ marginBottom: "12px" }}>
                  <Tooltip title={version.notes || "No notes provided"}>
                    <Text
                      style={{
                        color: token.colorTextBase,
                        fontSize: isMobile ? "10px" : "14px",
                        display: "block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                        maxLines:"2"
                      }}
                    >
                      {version.notes || "No notes provided"}
                    </Text>
                  </Tooltip>
                </div>

                {/* Action Buttons */}
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  flexWrap: "wrap", 
                  gap: "8px" 
                }}>
                  <div style={{ 
                    display: "flex", 
                    gap: "8px", 
                    flexWrap: "wrap",
                    flex: file.isOwner ? "1 1 auto" : "1 1 100%"
                  }}>
                    {renderActionButton(
                      <EyeOutlined />, 
                      "View", 
                      () => handleViewClick(version),
                      isActive ? "primary" : "default"
                    )}
                    
                    {renderActionButton(
                      <DownloadOutlined />, 
                      "Download", 
                      () => downloadFile(version)
                    )}
                    
                    {!version.hasOwnProperty("requestingApproval") && !version.requestingApproval && (
                      renderActionButton(
                        status ? <RollbackOutlined /> : <CloseOutlined />,
                        status ? "Restore" : "Revert",
                        () => {},
                        status ? "default" : "default",
                        status && version.hasOwnProperty("restore") && !version?.restore
                      )
                    )}
                    
                    {version.requestingApproval && (
                      <>
                        {renderActionButton(
                          <CheckOutlined />, 
                          "Approve", 
                          () => versionApproved(version),
                          "primary"
                        )}
                        
                        {renderActionButton(
                          <CloseOutlined />, 
                          "Reject", 
                          () => rejectApproved(version),
                          "default"
                        )}
                      </>
                    )}
                  </div>
                  
                  {file.isOwner && (
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "flex-end", 
                      flex: "0 0 auto" 
                    }}>
                      {renderActionButton(
                        <DeleteOutlined />, 
                        "Delete", 
                        () => deleteVersion(version),
                        "default",
                        false,
                        true
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Timeline.Item>
          );
        })}
      </Timeline>
    </div>
  );

  const baseView = baseVersion && (
    <div
      style={{
        width: baseWidth,
        padding: "0",
        backgroundColor: token.colorBgContainer,
        transition: "0.3s ease",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 57px)",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: `1px solid ${token.colorBorder}`,
          backgroundColor: token.colorBgElevated,
        }}
      >
        <Text strong style={{ color: token.colorTextBase, fontSize: isMobile ? "14px" : "16px" }}>
          {comparing ? "Base Version" : "Viewing"}: Version {baseVersion.id}
          {baseLoading && <Spin size="small" style={{ marginLeft: "10px" }} />}
        </Text>
        <Button
          icon={<CloseOutlined />}
          type="text"
          style={{ color: token.colorTextBase }}
          onClick={() => setBaseVersion(null)}
        />
      </div>
      <div
        style={{
          flex: 1,
          backgroundColor: token.colorBgContainer,
          padding: "16px",
          display: "flex",
          overflow: "hidden"
        }}
      >
        <FileViewer content={baseContent} loading={baseLoading} />
      </div>
    </div>
  );

  const targetView = targetVersion && (
    <div
      style={{
        width: targetWidth,
        padding: "0",
        backgroundColor: token.colorBgContainer,
        transition: "0.3s ease",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 57px)",
        borderLeft: `1px solid ${token.colorBorder}`,
        overflow: "hidden"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: `1px solid ${token.colorBorder}`,
          backgroundColor: token.colorBgElevated,
        }}
      >
        <Text strong style={{ color: token.colorTextBase, fontSize: isMobile ? "14px" : "16px" }}>
          Target Version: Version {targetVersion.id}
          {targetLoading && <Spin size="small" style={{ marginLeft: "10px" }} />}
        </Text>
        <Button
          icon={<CloseOutlined />}
          type="text"
          style={{ color: token.colorTextBase }}
          onClick={() => setTargetVersion(null)}
        />
      </div>
      <div
        style={{
          flex: 1,
          backgroundColor: token.colorBgContainer,
          padding: "16px",
          display: "flex",
          overflow: "hidden"
        }}
      >
        {comparing ? (
          <FileComparison 
            oldContent={baseContent} 
            newContent={targetContent} 
            loading={baseLoading || targetLoading} 
          />
        ) : (
          <FileViewer content={targetContent} loading={targetLoading} />
        )}
      </div>
    </div>
  );

  return (
    <Modal
      
      title={
        <div style={{ display: "flex", alignItems: "center" }}>
          <Title level={4} style={{ margin: 0, fontSize: isMobile ? "16px" : "20px" }}>
            Version History - {file?.name}
          </Title>
        </div>
      }
      open={visible}
      onCancel={() => {
        onClose();
        setBaseVersion(null);
        setTargetVersion(null);
      }}
      footer={null}
      width={width}
      style={{
        top: 0,
        padding: 0,
        margin: 0,
        maxWidth: "100vw",
      }}
      bodyStyle={{
        height: isFullScreen ? "calc(100vh - 57px)" : "auto",
        overflow: "hidden",
        padding: 0,
      }}
      centered={!isFullScreen}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          height: "100%",
          padding: "0",
          overflow: "hidden"
        }}
      >
        {timeline}
        {baseView}
        {targetView}
      </div>
    </Modal>
  );
};

export default VersionHistoryModal;