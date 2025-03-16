import React, { useState } from "react";
import { Layout, Button, Skeleton, message } from "antd";
import {
  UploadOutlined,
  FolderAddOutlined,
  HistoryOutlined,
  UnorderedListOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import Sidebar from "./components/Sidebar";
import FileTable from "./components/FileTable";
import VersionHistoryModal from "./components/VersionHistoryModal";
import BreadcrumbComponent from "./components/Breadcrumb";
import SearchBar from "./components/SearchBar";
import NewFolderModal from "./components/NewFolderModal";
import useFetchBuckets from "./hooks/useFetchBuckets"; // Import the custom hook
import useFileUpload from "./hooks/useFileUpload";
import UploadModal from "./components/UploadModal";

const { Content, Sider } = Layout;

const HomePage = () => {
  const [currentView, setCurrentView] = useState("main");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [newFolderModalVisible, setNewFolderModalVisible] = useState(false);

  const { 
    loading, 
    data: tableData, 
    error, 
    refresh, 
    currentFolder, 
    breadcrumbPath,
    handleFolderClick,
    handleBreadcrumbClick,
    navigateToBreadcrumb
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
    handleFileDrop(e, getCurrentBucketName());
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    setCurrentView("search");
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const showVersionHistory = (file) => {
    setCurrentFile(file);
    setVersionModalVisible(true);
  };

  // Go back to root folder
  const handleRootClick = () => {
    handleBreadcrumbClick();
    setCurrentView("main");
  };

  const getCurrentBucketName = () => {
    if (breadcrumbPath.length > 0) {
      // Return the name of the current folder
      return breadcrumbPath[breadcrumbPath.length - 1].name;
    }
    return null; // Root level
  };

  // Display error message if there's an error
  if (error) {
    message.error("Failed to fetch data. Please try again.");
  }

  return (
    <Layout>
      <Sider
        width={200}
        style={{ backgroundColor: "#121212", borderRight: "1px solid #333" }}
      >
        <Sidebar onCategoryClick={handleRootClick} />
      </Sider>
      <Content style={{ backgroundColor: "#121212", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <BreadcrumbComponent
            currentView={currentView}
            searchQuery={searchQuery}
            breadcrumbPath={breadcrumbPath}
            navigateToBreadcrumb={navigateToBreadcrumb}
          />
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleSearch={handleSearch}
          />
        </div>
        <div style={{ display: "flex", marginBottom: "20px" }}>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            style={{ marginRight: "10px", height: "38px" }}
            onClick={showUploadModal}
          >
            Upload
          </Button>
          <Button
            icon={<FolderAddOutlined />}
            style={{
              color: "#e6e6e6",
              backgroundColor: "#2a2a2a",
              borderColor: "#444",
              height: "38px",
            }}
            onClick={() => setNewFolderModalVisible(true)}
          >
            New Folder
          </Button>
          <Button
            icon={<HistoryOutlined />}
            style={{
              color: "#e6e6e6",
              backgroundColor: "#2a2a2a",
              borderColor: "#444",
              height: "38px",
              marginLeft: "10px",
            }}
            disabled={selectedRowKeys.length !== 1 || !tableData.find(item => item.key === selectedRowKeys[0])?.hasVersions}
            onClick={() => {
              const selectedFile = tableData.find(item => item.key === selectedRowKeys[0]);
              if (selectedFile && selectedFile.hasVersions) {
                showVersionHistory(selectedFile);
              }
            }}
          >
            Version History
          </Button>
          <Button
            icon={<SyncOutlined />}
            style={{
              color: "#e6e6e6",
              backgroundColor: "#2a2a2a",
              borderColor: "#444",
              height: "38px",
              marginLeft: "10px",
            }}
            onClick={refresh}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            type="text"
            icon={<UnorderedListOutlined />}
            style={{ marginLeft: "auto", color: "#e6e6e6" }}
          />
        </div>
        <div
          style={{
            backgroundColor: "#1a1a1a",
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
              // Skeleton Loading Effect
              <div style={{ padding: "16px" }}>
                {[...Array(5)].map((_, index) => (
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
                data={tableData}
                onFolderClick={handleFolderClick}
                onVersionClick={showVersionHistory}
                selectedRowKeys={selectedRowKeys}
                onSelectChange={onSelectChange}
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
        currentFolder={currentFolder}
        onSuccess={refresh}
        breadcrumbPath={breadcrumbPath}
      />
      <UploadModal
        breadcrumbPath={breadcrumbPath}
        fileList={fileList}
        currentBucketName={getCurrentBucketName()}
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