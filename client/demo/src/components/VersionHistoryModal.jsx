import React from "react";
import { Modal, Timeline, Button, Space, Typography, Tag, Tooltip, theme } from "antd";
import {
  EyeOutlined,
  DownloadOutlined,
  RollbackOutlined,
  CloseOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import api from "../utils/api";
import { blobToText, extractText, formatFileSize } from "../utils/fileUtils";
import DiffMatchPatch from "diff-match-patch";

const { Text } = Typography;

// FileViewer Component for displaying a single file
const FileViewer = ({ content }) => {
  const { token } = theme.useToken();
  
  return (
    <div
      style={{
        background: token.colorBgContainer,
        padding: "15px",
        borderRadius: "5px",
        color: token.colorTextBase,
        fontSize: "16px",
        lineHeight: "1.5",
        wordWrap: "break-word",
        width: "100%",
        height: "100%",
        overflow: "auto",
      }}
    >
      <pre style={{ whiteSpace: "pre-wrap" }}>{content}</pre>
    </div>
  );
};

// FileComparison Component
const FileComparison = ({ oldContent, newContent }) => {
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

  return (
    <div
      style={{
        background: token.colorBgContainer,
        padding: "15px",
        borderRadius: "8px",
        color: token.colorTextBase,
        width: "100%",
        paddingTop: 0,
      }}
    >
      <div
        dangerouslySetInnerHTML={{ __html: diffResult }}
        style={{
          background: token.colorBgContainer,
          padding: "15px",
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
  

  const [baseVersion, setBaseVersion] = React.useState(null);
  const [targetVersion, setTargetVersion] = React.useState(null);
  const [baseContent, setBaseContent] = React.useState("");
  const [targetContent, setTargetContent] = React.useState("");
  const [comparing, setComparing] = React.useState(false);

  // Use full screen when any panel is active
  const isFullScreen = React.useMemo(() => baseVersion !== null || targetVersion !== null, [baseVersion, targetVersion]);

  // Dynamically adjust modal width and height
  const width = React.useMemo(() => {
    if (isFullScreen) return "100vw";
    return 700;
  }, [isFullScreen]);

  const timelineWidth = React.useMemo(() => {
    if (baseVersion && targetVersion) return "20%";
    if (baseVersion || targetVersion) return "25%";
    return "100%";
  }, [baseVersion, targetVersion]);

  const baseWidth = React.useMemo(() => {
    if (baseVersion && targetVersion) return "40%";
    if (baseVersion) return "75%";
    return "0%";
  }, [baseVersion, targetVersion]);

  const targetWidth = React.useMemo(() => {
    if (baseVersion && targetVersion) return "40%";
    if (targetVersion && !baseVersion) return "75%";
    return "0%";
  }, [targetVersion, baseVersion]);

  // Fetch file content when base or target version changes
  React.useEffect(() => {
    const fetchBaseContent = async () => {
      if (baseVersion) {
        try {
          const data = await fileview(baseVersion);
          if (data?.blob) {
            const text = await blobToText(data.blob, file?.name,baseVersion.id);
            setBaseContent(text);
          }
        } catch (error) {
          console.error("Error fetching base content:", error);
          setBaseContent("Error loading file");
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
        console.log(targetVersion)
        try {
          const data = await fileview(targetVersion);
          if (data?.blob) {
            const text = await blobToText(data.blob, file?.name,targetVersion.id);
            setTargetContent(text);
          }
        } catch (error) {
          console.error("Error fetching target content:", error);
          setTargetContent("Error loading file");
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
    console.log(version)
    await api.Versions().approveVersion({
      versionID: version.id,
    });
    if (onrefersh) {
      onrefersh();
    }
  };

  const rejectApproved = async (version) => {
    await api.Versions().rejectVersion({
      versionID: version.id,
    });
    if (onrefersh) {
      onrefersh();
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

  const timeline = (
    <div
      style={{
        width: timelineWidth,
        transition: "0.3s ease",
        overflowY: "auto",
        height: isFullScreen ? "calc(100vh - 57px)" : "auto",
        borderRight: isFullScreen ? `1px solid ${token.colorBorder}` : "none",
      }}
    >
      <Timeline>
        {file?.versions?.map((version, index) => {
          const status = version.status === "approved";

          return (
            <Timeline.Item key={index} style={{paddingTop:7,paddingBottom:7}} color={!status ? "red" : "green"}>
              <div
                style={{
                  backgroundColor: token.colorBgContainer,
                  padding: "16px",
                  borderRadius: "8px",
                  border: `1px solid ${token.colorBorder}`,
                  marginBottom: "8px",
                  transition: "all 0.3s ease",
                  cursor: "pointer",
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
                  <Text strong style={{ color: token.colorTextBase, fontSize: "16px" }}>
                    {`Version ${file?.versions.length-index} ${
                      !status && version.hasOwnProperty("restore")
                        ? `<--- Version ${version.restore.id} `
                        : ""
                    }`}
                    {status ? (
                      <Tag color="green">{version.status}</Tag>
                    ) : (
                      <Tag color="red">{version.status}</Tag>
                    )}
                  </Text>
                  <Text style={{ color: token.colorTextSecondary, fontSize: "14px" }}>
                    {new Date(version.created_at).toLocaleDateString("en-US", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                </div>

                {/* Version Details */}
                <div style={{ marginBottom: "12px" }}>
                  <Text style={{ color: token.colorTextSecondary, fontSize: "14px" }}>
                    Size: {formatFileSize(version.size)} • Modified by: {version.uploader}
                  </Text>
                </div>

                {/* Version Notes - with text truncation */}
                <div style={{ marginBottom: "12px" }}>
                  <Tooltip title={version.notes}>
                    <Text
                      style={{
                        color: token.colorTextBase,
                        fontSize: "14px",
                        display: "block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                      }}
                    >
                      {version.notes}
                    </Text>
                  </Tooltip>
                </div>

                {/* Action Buttons */}
               <div  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <Button
                    icon={<EyeOutlined />}
                    style={{
                      backgroundColor: token.colorBgContainer,
                      borderColor: token.colorBorder,
                      color: token.colorTextBase,
                    }}
                    onClick={() => handleViewClick(version)}
                  >
                    View
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    style={{
                      backgroundColor: token.colorBgContainer,
                      borderColor: token.colorBorder,
                      color: token.colorTextBase,
                    }}
                    onClick={() => {
                      downloadFile(version);
                    }}
                  >
                    Download
                  </Button>

                  {!version.hasOwnProperty("requestingApproval") && !version.requestingApproval && (
                    <Button
                      icon={status ? <RollbackOutlined /> : <CloseOutlined />}
                      style={{
                        backgroundColor: token.colorBgContainer,
                        borderColor: token.colorBorder,
                        color: status && version.hasOwnProperty("restore") && !version?.restore
                          ? "dimgray"
                          : "red",
                      }}
                    >
                      {status ? "Restore" : "Revert"}
                    </Button>
                  )}

                  {version.requestingApproval && (
                    <>
                      <Button
                        icon={<CheckOutlined />}
                        style={{
                          backgroundColor: token.colorBgContainer,
                          borderColor: token.colorBorder,
                          color: token.colorTextBase,
                        }}
                        onClick={() => {
                          versionApproved(version);
                        }}
                      >
                        Approve
                      </Button>

                      <Button
                        icon={<CloseOutlined />}
                        style={{
                          backgroundColor: token.colorBgContainer,
                          borderColor: token.colorBorder,
                          color: token.colorTextBase,
                        }}
                        onClick={() => {
                          rejectApproved(version);
                        }}
                      >
                        Reject
                      </Button>
                      
                      
                      
                    </>
                  )}
                  
                 
                </div>
                {file.isOwner && <Button danger  onClick={async ()=>{

                  await api.Items().removeItem({
                    itemID:file.id,
                    versionID:version.id
                  })

                }}>Delete</Button>}
                
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
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: `1px solid ${token.colorBorder}`,
        }}
      >
        <Text strong style={{ color: token.colorTextBase, fontSize: "16px" }}>
          {comparing ? "Base Version" : "Viewing"}: Version {baseVersion.id}
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
          alignItems: "center",
          justifyContent: "center",
          overflow: "auto",
        }}
      >
        <FileViewer content={baseContent} />
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
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: `1px solid ${token.colorBorder}`,
          backgroundColor: token.colorBgContainer,
        }}
      >
        <Text strong style={{ color: token.colorTextBase, fontSize: "16px" }}>
          Target Version: Version {targetVersion.id}
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
          overflow: "auto",
        }}
      >
        {comparing ? (
          <FileComparison oldContent={baseContent} newContent={targetContent} />
        ) : (
          <FileViewer content={targetContent} />
        )}
      </div>
    </div>
  );

  return (
    <Modal
      title={`Version History - ${file?.name}`}
      visible={visible}
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
