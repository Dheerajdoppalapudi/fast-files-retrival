import { useState, useEffect } from "react";
import api from "../utils/api";

const useFetchBuckets = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [breadcrumbPath, setBreadcrumbPath] = useState([]); // Track navigation path
  const [currentLocation, setCurrentLocation] = useState({ name: "Root" }); // Track current location

  // Fetch folders and files
  const fetchData = async (folder = null) => {
    setLoading(true);
    try {
      // Use the listAllContent API
      const result = (await api.Buckets().listAllContent({
        bucketId: folder ? folder.id : -1, // Pass -1 for root level
      })).data;


      console.log(result)
      // Update current location
      setCurrentLocation(result.currentLocation);

      // Transform folders and files into a unified data structure
      const transformedData = [
        ...result.folders.map((folder) => ({
          key: folder.id.toString(),
          id: folder.id,
          name: folder.name,
          modified: "-", // Folders don't have a modified date in the provided JSON
          size: "-", // Folders don't have a size
          hasVersions: false, // Folders don't have versions
          isFolder: true,
          versions: [], // Folders don't have versions
        })),
        ...result.files.map((file) => ({
          key: file.id.toString(),
          id: file.id,
          name: file.name,
          modified: new Date(file.latestVersion.createdAt).toLocaleString(),
          size: formatFileSize(file.latestVersion.size),
          hasVersions: file.versions.length > 1, // Check if multiple versions exist
          isFolder: false,
          versions: file.versions, // Include all versions
        })),
      ];
      setData(transformedData);
    } catch (err) {
      setError(err);
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Handle folder navigation
  const handleFolderClick = (folderId, folderName) => {
    // Add the new folder to the breadcrumb path
    setBreadcrumbPath((prev) => [...prev, { id: folderId, name: folderName }]);
  };

  // Navigate to a specific point in the breadcrumb path
  const navigateToBreadcrumb = (index) => {
    if (index === -1) {
      // Go to root
      setBreadcrumbPath([]);
    } else {
      // Go to specific folder in path
      setBreadcrumbPath((prev) => prev.slice(0, index + 1));
    }
  };

  // Handle going back to the root folder
  const handleBreadcrumbClick = () => {
    setBreadcrumbPath([]);
  };

  // Fetch data when breadcrumbPath changes
  useEffect(() => {
    const lastFolder = breadcrumbPath.length > 0 ? breadcrumbPath[breadcrumbPath.length - 1] : null;
    fetchData(lastFolder);
  }, [breadcrumbPath]);

  return {
    loading,
    data,
    error,
    currentLocation,
    breadcrumbPath,
    refresh: () => {
      const lastFolder = breadcrumbPath.length > 0 ? breadcrumbPath[breadcrumbPath.length - 1] : null;
      fetchData(lastFolder);
    },
    handleFolderClick,
    handleBreadcrumbClick,
    navigateToBreadcrumb,
  };
};

export default useFetchBuckets;