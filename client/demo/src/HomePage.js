import React, { useState, useEffect } from "react";
import { Layout, Button, Skeleton, message, Badge, theme } from "antd";
import {
  UploadOutlined,
  FolderAddOutlined,
  HistoryOutlined,
  SyncOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import Sidebar from "./components/Sidebar";
import FileTable from "./components/FileTable";
import VersionHistoryModal from "./components/VersionHistoryModal";
import BreadcrumbComponent from "./components/Breadcrumb";
import SearchBar from "./components/SearchBar";
import NewFolderModal from "./components/NewFolderModal";
import useFetchBuckets from "./hooks/useFetchBuckets";
import useFileUpload from "./hooks/useFileUpload";
import UploadModal from "./components/UploadModal";

const { useToken } = theme;
const { Content, Sider } = Layout;

const HomePage = () => {
  const [currentView, setCurrentView] = useState("main");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [newFolderModalVisible, setNewFolderModalVisible] = useState(false);

  const { token } = useToken(); // Getting the current theme tokens

  const {
    loading,
    data: tableData,
    error,
    currentCategory,
    refresh,
    currentLocation,
    breadcrumbPath,
    handleFolderClick,
    handleBreadcrumbClick,
    navigateToBreadcrumb,
    handleCategoryChange,
    approvalCount,
  } = useFetchBuckets();

  const {
    uploading,
    uploadProgress,
    fileList,
    uploadModalVisible,
    showUploadModal,
    hideUploadModal,
    handleFileListChange,
    uploadFiles,
    handleFileDrop,
  } = useFileUpload(() => {
    refresh();
  });

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileDrop(e, getCurrentBucket().id);
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    setCurrentView(value ? "search" : "main");
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const showVersionHistory = (file) => {
    setCurrentFile(file);
    setVersionModalVisible(true);
  };

  const getCurrentBucket = () => {
    if (breadcrumbPath.length > 0) {
      return breadcrumbPath[breadcrumbPath.length - 1];
    }
    return null;
  };

  const handleApprovalClick = () => {
    handleCategoryChange({
      key: "Approval",
      title: "Approval",
    });
  };

  useEffect(() => {
    if (error) {
      message.error("Failed to fetch data. Please try again.");
    }
  }, [error]);

  return (
    <Layout>
      <Sider
        width={200}
        style={{
          backgroundColor: token.colorBgBase,
          borderRight: `1px solid ${token.colorBorder}`,
        }}
      >
        <Sidebar onCategoryClick={handleCategoryChange} selectedKeys={currentCategory} />
      </Sider>
      <Content
        style={{
          backgroundColor: token.colorBgBase,
          padding: "20px",
       
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <BreadcrumbComponent
            currentView={currentView}
            searchQuery={searchQuery}
            breadcrumbPath={breadcrumbPath}
            navigateToBreadcrumb={navigateToBreadcrumb}
            currentCategory={currentCategory}
          />
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleSearch={handleSearch}
          />
        </div>
        <div style={{ display: "flex", marginBottom: "20px" }}>
          <Button
            disabled={(getCurrentBucket()&&!getCurrentBucket().permissionType)||currentCategory.key === "Approval"}
            type="primary"
            icon={<UploadOutlined />}
            style={{
             
              height: "38px",
              backgroundColor: token.colorPrimary,
              borderColor: token.colorPrimary,
              transition: "all 0.3s ease",
              boxShadow:
                currentCategory.key === "Approval"
                  ? "none"
                  : "0 2px 10px rgba(0, 0, 0, 0.1)",
            }}
            onClick={showUploadModal}
          >
            {token.theme === "dark" ? "Upload" : "Upload File"}
          </Button>
          <Button
            disabled={(getCurrentBucket()&&!getCurrentBucket().permissionType)|| currentCategory.key === "Approval"}
            icon={<FolderAddOutlined />}
            style={{
              color:  "#e6e6e6",
              height: "38px",
              marginLeft: "10px",
              backgroundColor: "#2a2a2a",
              transition: "all 0.3s ease",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
               
              ...(getCurrentBucket()&&!getCurrentBucket()?.permissionType||currentCategory.key === "Approval"
              ?{color:null,backgroundColor:null,borderColor:null,boxShadow:null}:{}
            
            )
            }}
            onClick={() => setNewFolderModalVisible(true)}
          >
            {token.theme === "dark" ? "New Folder" : "Create Folder"}
          </Button>
          <Button
            icon={<HistoryOutlined />}
            style={{
              color: "#e6e6e6",
              backgroundColor: "#2a2a2a",
              borderColor: "#444",
              height: "38px",
              marginLeft: "10px",
              transition: "all 0.3s ease",
            }}
            disabled={selectedRowKeys.length !== 1 || !tableData.find(item => item.key === selectedRowKeys[0])?.hasVersions}
            onClick={() => {
              const selectedFile = tableData.find(item => item.key === selectedRowKeys[0]);
              if (selectedFile && selectedFile.hasVersions) {
                showVersionHistory(selectedFile);
              }
            }}
          >
            {token.theme === "dark" ? "Version History" : "File Versions"}
          </Button>
          <Button
            icon={<SyncOutlined />}
            style={{
              color: "#e6e6e6",
              backgroundColor: "#2a2a2a",
              borderColor: "#444",
              height: "38px",
              marginLeft: "10px",
              transition: "all 0.3s ease",
            }}
            onClick={refresh}
            loading={loading}
          >
            {token.theme === "dark" ? "Refresh" : "Reload"}
          </Button>
          <Button
            onClick={handleApprovalClick}
            icon={
              <Badge count={approvalCount} style={{ backgroundColor: '#52c41a' }}>
                <CheckCircleOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
              </Badge>
            }
            style={{
              color: "#e6e6e6",
              backgroundColor:
                currentCategory.key === "Approval" ? "#1890ff" : "#2a2a2a",
              borderColor: "#444",
              height: "38px",
              marginLeft: "10px",
              transition: "all 0.3s ease",
              boxShadow:
                currentCategory.key === "Approval"
                  ? "0 2px 10px rgba(24, 144, 255, 0.2)"
                  : "none",
            }}
          >
            {token.theme === "dark" ? "Pending Approval" : "Awaiting Approval"}
          </Button>
        </div>
        <div
          style={{
            backgroundColor: token.colorBgContainer,
            borderRadius: "8px",
            overflow: "hidden",
            height: "calc(100vh - 200px)",
            overflowY: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              height: "100%",
              overflowY: "auto",
              scrollbarWidth: "thin",
              scrollbarColor: "#555 #1a1a1a",
              paddingRight: "8px",
              marginRight: "-8px",
            }}
            className="custom-scrollbar"
          >
            {loading ? (
              <div style={{ padding: "16px" }}>
                {[...Array(6)].map((_, index) => (
                  <Skeleton
                    key={index}
                    active
                    avatar={{ shape: "square", size: "large" }}
                    paragraph={{ rows: 1, width: ["100%"] }}
                    title={false}
                    style={{ marginBottom: "16px" }}
                  />
                ))}
              </div>
            ) : (
              <FileTable
                data={tableData.filter((it) => it.name.toLowerCase().includes(searchQuery.toLowerCase()))}
                onFolderClick={handleFolderClick}
                onVersionClick={showVersionHistory}
                selectedRowKeys={selectedRowKeys}
                onSelectChange={onSelectChange}
                onSuccess={refresh}
              />
            )}
          </div>
        </div>
      </Content>
      <VersionHistoryModal
        visible={versionModalVisible}
        onClose={() => setVersionModalVisible(false)}
        file={currentFile}
        onrefersh={refresh}
      />
      <NewFolderModal
        visible={newFolderModalVisible}
        onCancel={() => setNewFolderModalVisible(false)}
        currentFolder={currentLocation}
        onSuccess={refresh}
        breadcrumbPath={breadcrumbPath}
      />
      <UploadModal
        breadcrumbPath={breadcrumbPath}
        fileList={fileList}
        currentBucketID={getCurrentBucket()?.id||null}
        onFileListChange={handleFileListChange}
        uploadProgress={uploadProgress}
        visible={uploadModalVisible}
        uploading={uploading}
        onCancel={hideUploadModal}
        onUpload={uploadFiles}
      />
    </Layout>
  );
};

export default HomePage;
