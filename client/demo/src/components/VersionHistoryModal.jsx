import React, { version } from "react";
import { Modal, Timeline, Button, Space, Typography, Tag, Tooltip } from "antd";
import {
  EyeOutlined,
  DownloadOutlined,
  RollbackOutlined,
  CloseOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import api from "../utils/api";
import { formatFileSize } from "../utils/fileUtils";

const { Text } = Typography;

const VersionHistoryModal = ({ visible, onClose, file,onrefersh }) => {
  const [left, setLeft] = React.useState(null);
  const [right, setRight] = React.useState(null);

  // Use full screen when any panel is active
  const isFullScreen = React.useMemo(() => left !== null || right !== null, [left, right]);

  // Dynamically adjust modal width and height
  const width = React.useMemo(() => {
    if (isFullScreen) return "100vw";
    return 700;
  }, [isFullScreen]);

  const timelineWidth = React.useMemo(() => {
    if (left && right) return "20%";
    if (left || right) return "25%";
    return "100%";
  }, [left, right]);

  const leftWidth = React.useMemo(() => {
    if (left && right) return "40%";
    if (left) return "75%";
    return "0%";
  }, [left, right]);

  const rightWidth = React.useMemo(() => {
    if (left && right) return "40%";
    if (right && !left) return "75%";
    return "0%";
  }, [right, left]);

  const handleViewClick = (version) => {
    if (!left) {
      setLeft(version);
    } else if (!right && left !== version) {
      setRight(version);
    } else {
      if (left === version) {
        setLeft(right);
        setRight(null);
      } else {
        setLeft(version);
      }
    }
  };


  const versionApproved = async (version) =>{
    await api.Versions().approveVersion({
       versionID:version.versionId
    })
    if (onrefersh){
      onrefersh()
    }

  }

  const rejectApproved = async (version) =>{
    await api.Versions().rejectVersion({
       versionID:version.versionId
    })
    if (onrefersh){
      onrefersh()
    }

  }

  const fileview =async(version)=>{
    return await api.Versions().getFileWithProgress({
      versionID: version.versionId, // Pass as first argument
      onProgress: (progress) => {
         console.log(`Download Progress: ${progress}%`);
       }
     }
     );
  }

  const downloadFile = async (version) => {
    try {
      const fileData=await fileview(version)
      if (fileData?.blob) {
        const url = window.URL.createObjectURL(fileData.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file?.name; // Change extension based on file type
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        console.error('No file data received');
      
    }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const timeline = (
    <div 
      style={{ 
        width: timelineWidth, 
        transition: "0.3s ease",
        overflowY: "auto",
        height: isFullScreen ? "calc(100vh - 57px)" : "auto",
        borderRight: isFullScreen ? "1px solid #333" : "none"
      }}
    >
      <Timeline>
        {file?.versions?.map((version, index) =>{
          
          const status=version.status==="approved";
          
          return <Timeline.Item key={index} color={!status ? "red" : "green"}>
            <div
              style={{
                backgroundColor: "#2a2a2a",
                padding: "16px",
                borderRadius: "8px",
                border: "1px solid #333",
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
                <Text strong style={{ color: "#e6e6e6", fontSize: "16px" }}>
                  {`Version ${version.id} ${
                    !status && version.hasOwnProperty("restore")
                      ? `<--- Version ${version.restore.id} `
                      : ""
                  }`}
                  {status ? (
                    <Tag color="green">Approved</Tag>
                  ) : (
                    <Tag color="red">Pending</Tag>
                  )}
                </Text>
                <Text style={{ color: "#aaa", fontSize: "14px" }}>
                  {new Date(version.created_at).toLocaleDateString('en-US', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})}
                </Text>
              </div>

              {/* Version Details */}
              <div style={{ marginBottom: "12px" }}>
                <Text style={{ color: "#aaa", fontSize: "14px" }}>
                  Size: {formatFileSize(version.size)} • Modified by: {version.uploader}
                </Text>
              </div>

              {/* Version Notes - with text truncation */}
              <div style={{ marginBottom: "12px" }}>
                <Tooltip title={version.notes}>
                  <Text 
                    style={{ 
                      color: "#e6e6e6", 
                      fontSize: "14px",
                      display: "block",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "100%"
                    }}
                  >
                    {version.notes}
                  </Text>
                </Tooltip>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <Button
                  icon={<EyeOutlined />}
                  style={{
                    backgroundColor: "#1a1a1a",
                    borderColor: "#444",
                    color: "#e6e6e6",
                  }}
                  onClick={() => handleViewClick(version)}
                >
                  View
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  style={{
                    backgroundColor: "#1a1a1a",
                    borderColor: "#444",
                    color: "#e6e6e6",
                  }}
                  onClick={()=>{
                    downloadFile(version)
                  }}
                >
                  Download
                </Button>
                
                {
                  !version.hasOwnProperty("requestingApproval") &&
                
                <Button
                  icon={
                    status ? <RollbackOutlined /> : <CloseOutlined />
                  }
                  style={{
                    backgroundColor: "#1a1a1a",
                    borderColor: "#444",
                    color:
                      status &&
                      version.hasOwnProperty("restore") &&
                      !version?.restore
                        ? "dimgray"
                        : "red",
                  }}
                  disabled={
                    status &&
                    version.hasOwnProperty("restore") &&
                    !version?.restore
                  }
                >
                  {status ? "Restore" : "Revert"}
                </Button>
        }



               { version.requestingApproval&& <>

                <Button
                  icon={<CheckOutlined />}
                  style={{
                    backgroundColor: "#1a1a1a",
                    borderColor: "#444",
                    color: "#e6e6e6",
                  }}
                  onClick={()=>{
                    versionApproved(version)
                  }}
                >
                  Approve
                </Button>

                <Button
                  icon={<CloseOutlined />}
                  style={{
                    backgroundColor: "#1a1a1a",
                    borderColor: "#444",
                    color: "#e6e6e6",
                  }}
                  onClick={()=>{
                    rejectApproved(version)
                  }}
                >
                  Reject
                </Button>
               
               </>
                }

              </div>
            </div>
          </Timeline.Item>
        }
        
        
      )
    
    }
      </Timeline>
    </div>
  );

  const leftView = left && (
    <div
      style={{
        width: leftWidth,
        padding: "0",
        backgroundColor: "#1a1a1a",
        transition: "0.3s ease",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 57px)"
      }}
    >
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid #333"
      }}>
        <Text strong style={{ color: "#e6e6e6", fontSize: "16px" }}>
          {left === right ? "Viewing" : "Comparing"}: Version {left.version}
        </Text>
        <Button 
          icon={<CloseOutlined />} 
          type="text" 
          style={{ color: "#e6e6e6" }}
          onClick={() => setLeft(null)}
        />
      </div>
      <div style={{ padding: "16px", marginBottom: "12px" }}>
        <Text style={{ color: "#aaa", fontSize: "14px", display: "block" }}>
          {left.notes}
        </Text>
      </div>
      <div style={{ 
        flex: 1,
        backgroundColor: "#262626",
        padding: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "auto"
      }}>
        <Text style={{ color: "#888" }}>File content preview</Text>
      </div>
    </div>
  );

  const rightView = right && (
    <div
      style={{
        width: rightWidth,
        padding: "0",
        backgroundColor: "#1a1a1a",
        transition: "0.3s ease",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 57px)",
        borderLeft: "1px solid #333"
      }}
    >
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid #333"
      }}>
        <Text strong style={{ color: "#e6e6e6", fontSize: "16px" }}>
          Comparing: Version {right.version}
        </Text>
        <Button 
          icon={<CloseOutlined />} 
          type="text" 
          style={{ color: "#e6e6e6" }}
          onClick={() => setRight(null)}
        />
      </div>
      <div style={{ padding: "16px", marginBottom: "12px" }}>
        <Text style={{ color: "#aaa", fontSize: "14px", display: "block" }}>
          {right.notes}
        </Text>
      </div>
      <div style={{ 
        flex: 1,
        backgroundColor: "#262626",
        padding: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "auto"
      }}>
        <Text style={{ color: "#888" }}>File content preview</Text>
      </div>
    </div>
  );

  return (
    <Modal
      title={`Version History - ${file?.name}`}
      visible={visible}
      onCancel={() => {
        onClose();
        setLeft(null);
        setRight(null);
      }}
      footer={null}
      width={width}
      style={{ 
        top: 0,
        padding: 0,
        margin: 0,
        maxWidth: "100vw"
      }}
      bodyStyle={{
        height: isFullScreen ? "calc(100vh - 57px)" : "auto",
        overflow: "hidden",
        padding: 0
      }}
      centered={!isFullScreen}
      destroyOnClose={true}
      maskStyle={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}
      wrapClassName={isFullScreen ? "fullscreen-modal" : ""}
    >
      <div style={{ 
        display: "flex", 
        width: "100%",
        height: "100%",
        scrollbarWidth: "none",
      }}>
        {timeline}
        {leftView}
        {rightView}
      </div>
    </Modal>
  );
};

// Add this CSS to your stylesheet for the fullscreen modal
// .fullscreen-modal .ant-modal {
//   max-width: 100vw;
//   top: 0;
//   padding-bottom: 0;
//   margin: 0;
// }
// 
// .fullscreen-modal .ant-modal-content {
//   height: 100vh;
//   border-radius: 0;
// }

export default VersionHistoryModal;