import { useState, useEffect } from "react";
import api from "../utils/api";
import { formatFileSize } from "../utils/fileUtils";

const useFetchBuckets = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [breadcrumbPath, setBreadcrumbPath] = useState([]);
  const [currentLocation, setCurrentLocation] = useState({ name: "Root" });
  const [currentCategory, setCurrentCategory] = useState({
    key:"All files",title: 'All files' 
  });

  const processApiData = (result) => {
    if (!result) return [];

    return [
      ...result.folders.map((folder) => ({
        key: folder.id.toString(),
        id: folder.id,
        name: folder.name,
        permissionType: folder.permissionType,
        modified: new Date(folder.modified).toLocaleString(),
        size: "-",
        hasVersions: false,
        isFolder: true,
        versions: [],
      })),
      ...result.files.map((file) => ({
        key: file.id.toString(),
        id: file.id,
        name: file.name,
        modified: new Date(file.latestVersion.created_at).toLocaleString(),
        size: formatFileSize(file.latestVersion.size),
        hasVersions: file.versions.length > 1,
        isFolder: false,
        permissionType: file.permissionType,
        latestversion: file.latestVersion,
        versions: file.versions,
      })),
    ];
  };

  const fetchDataByCategory = async (category, folder = null) => {
    setLoading(true);
    try {
      let result;
      switch (category.key) {
        case "All files":
          result = (await api.Buckets().listAllContent({
            bucketId: folder ? folder.id : -1,
          })).data;
          break;
        case "txt":
        case "pdf":
        case "Spreadsheets":
        case "docx":
        case "Other":
          result = (await api.Buckets().listAllContentbyExtension({
            extension: category.key.toLowerCase(),
          })).data;
          break;
        default:
          result = (await api.Buckets().listAllContent({
            bucketId: folder ? folder.id : -1,
          })).data;
          break;
      }

      setCurrentLocation(result.currentLocation);
      const transformedData = processApiData(result);
      setData(transformedData);
    } catch (err) {
      setError(err);
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folderId, folderName) => {
    setBreadcrumbPath((prev) => [...prev, { id: folderId, name: folderName }]);
  };

  const navigateToBreadcrumb = (index) => {
    if (index === -1) {
      setBreadcrumbPath([]);
    } else {
      setBreadcrumbPath((prev) => prev.slice(0, index + 1));
    }
  };

  const handleBreadcrumbClick = () => {
    setBreadcrumbPath([]);
  };

  const handleCategoryChange = (category) => {
    setCurrentCategory(category);
    
  };

  // Fetch data when breadcrumbPath or currentCategory changes
  useEffect(() => {
    const lastFolder = breadcrumbPath.length > 0 ? breadcrumbPath[breadcrumbPath.length - 1] : null;
    fetchDataByCategory(currentCategory, lastFolder);
  }, [breadcrumbPath, currentCategory]);

  return {
    loading,
    data,
    error,
    currentLocation,
    breadcrumbPath,
    currentCategory,
    refresh: () => {
      const lastFolder = breadcrumbPath.length > 0 ? breadcrumbPath[breadcrumbPath.length - 1] : null;
      fetchDataByCategory(currentCategory, lastFolder);
    },
    handleFolderClick,
    handleBreadcrumbClick,
    navigateToBreadcrumb,
    handleCategoryChange,
  };
};

export default useFetchBuckets;