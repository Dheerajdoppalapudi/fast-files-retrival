import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Button, Input, Modal, message } from "antd";
import { FolderAddOutlined, UploadOutlined } from "@ant-design/icons";
import BreadcrumbNav from "./BreadcrumbNav";
import SearchBar from "./SearchBar";
import FileList from "./FileList";

const FileManager = () => {
  const [files, setFiles] = useState({});
  const [currentPath, setCurrentPath] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [folderName, setFolderName] = useState("");
  const [isFolderModalVisible, setIsFolderModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Fetch files whenever the current path changes
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const folderPath = currentPath.length > 0 ? currentPath.join("/") : "";
      const response = await axios.get("http://localhost:8000/files", {
        params: { path: folderPath }
      });
      
      if (response.data) {
        setFiles(buildFolderStructure(response.data));
      }
    } catch (error) {
      console.error("Error fetching files:", error);
      message.error("Failed to load files. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const buildFolderStructure = (fileList) => {
    const structure = {};

    fileList.forEach((item) => {
      if (item.type === "folder") {
        // Handle folders
        const parts = item.filename.split("/");
        const folderName = parts[parts.length - 1];
        structure[folderName] = { isFolder: true };
      } else if (item.type === "file") {
        // Handle files
        const parts = item.filename.split("/");
        const fileName = parts[parts.length - 1];
        structure[fileName] = { 
          isFolder: false, 
          versions: item.versions 
        };
      }
    });

    return structure;
  };

  const getCurrentView = () => {
    const filteredItems = Object.entries(files).filter(([name]) =>
      name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    return filteredItems.sort((a, b) => {
      // Sort folders first, then files alphabetically
      if (a[1].isFolder && !b[1].isFolder) return -1;
      if (!a[1].isFolder && b[1].isFolder) return 1;
      return a[0].localeCompare(b[0]);
    });
  };

  const navigateToFolder = (folder) => {
    setCurrentPath([...currentPath, folder]);
    setSearchQuery("");
  };

  const navigateToBreadcrumb = (index) => {
    setCurrentPath(currentPath.slice(0, index));
    setSearchQuery("");
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    
    const fullPath = currentPath.length > 0 
      ? `${currentPath.join("/")}/${folderName}` 
      : folderName;

    try {
      await axios.post("http://localhost:8000/files/create-directory", { 
        folderPath: fullPath 
      });
      
      fetchFiles();
      setFolderName("");
      setIsFolderModalVisible(false);
      message.success(`Folder "${folderName}" created successfully`);
    } catch (error) {
      console.error("Error creating folder:", error);
      message.error("Failed to create folder. Please try again.");
    }
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("directory", currentPath.join("/")); 

    try {
      await axios.post("http://localhost:8000/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSelectedFile(null);
      fetchFiles();
      message.success("File uploaded successfully");
    } catch (error) {
      console.error("Upload failed:", error);
      message.error("Failed to upload file. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-manager">
      <h2>File Manager</h2>

      <div className="file-manager-controls">
        <BreadcrumbNav 
          currentPath={currentPath} 
          onNavigate={navigateToBreadcrumb} 
        />
        <SearchBar 
          searchQuery={searchQuery} 
          onSearch={setSearchQuery} 
        />
      </div>

      <div className="file-manager-actions">
        <Button 
          type="primary" 
          icon={<FolderAddOutlined />}
          onClick={() => setIsFolderModalVisible(true)} 
          style={{ marginRight: 16 }}
        >
          Create Folder
        </Button>
        
        <div className="file-upload">
          <input 
            type="file" 
            id="file-input"
            onChange={handleFileChange} 
            style={{ display: 'none' }}
          />
          <Button 
            icon={<UploadOutlined />}
            onClick={() => document.getElementById('file-input').click()}
            style={{ marginRight: 8 }}
          >
            Select File
          </Button>
          <Button 
            type="primary"
            onClick={handleUpload} 
            disabled={uploading || !selectedFile}
            loading={uploading}
          >
            Upload
          </Button>
          {selectedFile && (
            <span className="selected-file-name" style={{ marginLeft: 8 }}>
              {selectedFile.name}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-container">Loading files...</div>
      ) : (
        <FileList 
          files={getCurrentView()} 
          onNavigate={navigateToFolder} 
        />
      )}

      <Modal 
        title="Create New Folder" 
        open={isFolderModalVisible} 
        onOk={handleCreateFolder} 
        onCancel={() => setIsFolderModalVisible(false)}
        okButtonProps={{ disabled: !folderName.trim() }}
      >
        <Input 
          value={folderName} 
          onChange={(e) => setFolderName(e.target.value)} 
          placeholder="Enter folder name" 
          autoFocus
          onPressEnter={handleCreateFolder}
        />
      </Modal>
    </div>
  );
};

export default FileManager;