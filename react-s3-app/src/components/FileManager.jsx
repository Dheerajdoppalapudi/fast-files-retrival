import React, { useEffect, useState } from "react";
import axios from "axios";
import BreadcrumbNav from "./BreadcrumbNav";
import SearchBar from "./SearchBar";
import FileList from "./FileList";

const FileManager = () => {
  const [files, setFiles] = useState({});
  const [currentPath, setCurrentPath] = useState([]); // Tracks folder navigation
  const [searchQuery, setSearchQuery] = useState(""); // Stores search input
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await axios.get("http://localhost:8000/files");
        if (response.data.success) {
          setFiles(response.data.files);
        }
      } catch (error) {
        console.error("Error fetching files:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, []);

  const navigateToFolder = (folder) => {
    setCurrentPath([...currentPath, folder]);
    setSearchQuery(""); // Reset search when navigating
  };

  const navigateToBreadcrumb = (index) => {
    setCurrentPath(currentPath.slice(0, index));
    setSearchQuery(""); // Reset search when navigating
  };

  const getCurrentView = (folderStructure, path) => {
    return path.reduce((acc, key) => acc[key] || {}, folderStructure);
  };

  const currentView = getCurrentView(files, currentPath);

  const filteredItems = Object.entries(currentView).filter(([name]) =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <h2>File Manager</h2>

      <BreadcrumbNav currentPath={currentPath} onNavigate={navigateToBreadcrumb} />

      <SearchBar searchQuery={searchQuery} onSearch={setSearchQuery} />

      {loading ? <p>Loading files...</p> : <FileList files={filteredItems} onNavigate={navigateToFolder} />}
    </div>
  );
};

export default FileManager;
