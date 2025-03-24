import { useState, useEffect, useRef } from "react";
import api from "../utils/api";
import { formatFileSize } from "../utils/fileUtils";

const useFetchBuckets = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [breadcrumbPath, setBreadcrumbPath] = useState([]);
  const [currentLocation, setCurrentLocation] = useState({ name: "Root" });
  const [currentCategory, setCurrentCategory] = useState({
    key: "All files",
    title: "All files",
  });
  const [approvalCount, setApprovalCount] = useState(0);
  const initialLoadRef = useRef(true);
  
  // Reference to track loading timeout
  const loadingTimerRef = useRef(null);
  // Minimum loading time in milliseconds (e.g., 500ms)
  const MINIMUM_LOADING_TIME = 500;

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
        isApprover:folder?.isApprover||false,
        isOwner:folder.isOwner||false,
        owner:folder.owner||{}
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
        isApprover:file?.isApprover||false,
        isOwner:file.isOwner||false,
        owner:file.owner||{}
      })),
    ];
  };

  // Fetch approval count independently
  const fetchApprovalCount = async () => {
    try {
      const result = (await api.Buckets().listBucketApproval()).data;
      setApprovalCount(result.files.length);
    } catch (err) {
      console.error("Error fetching approval count:", err);
    }
  };

  const fetchDataByCategory = async (category, folder = null) => {
    // Clear any existing loading timer
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
    }
    
    // Start loading state
    setLoading(true);
    const startTime = Date.now();
    
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
        case "PPTX":
          result = (await api.Buckets().listAllContentbyExtension({
            extension: category.key.toLowerCase(),
          })).data;
          break;
        case "Approval":
          result = (await api.Buckets().listBucketApproval()).data;
          // Set approval count from the API call
          setApprovalCount(result.files.length);
          break;
        default:
          result = (await api.Buckets().listAllContent({
            bucketId: folder ? folder.id : -1,
          })).data;
          break;
      }

      setCurrentLocation(result.currentLocation);
      const transformedData = processApiData(result);
      
      // Calculate how much time has passed since loading started
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, MINIMUM_LOADING_TIME - elapsedTime);
      
      // If we've already displayed loading for the minimum time, update immediately
      if (remainingTime === 0) {
        setData(transformedData);
        setLoading(false);
      } else {
        // Otherwise, wait until we've hit the minimum loading time
        loadingTimerRef.current = setTimeout(() => {
          setData(transformedData);
          setLoading(false);
        }, remainingTime);
      }
    } catch (err) {
      setError(err);
      console.error("Error fetching data:", err);
      setLoading(false);
    }
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);

  // Fetch approval count on initial load
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      fetchApprovalCount();
    }
  }, []);

  const handleFolderClick = (folderId, folderName,permissionType=true) => {
    setBreadcrumbPath((prev) => [...prev, { id: folderId, name: folderName,permissionType:permissionType }]);
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
    // Reset breadcrumb path when selecting any category other than "All files"
    if (category.key !== "All files") {
      setBreadcrumbPath([]);
    }
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
    approvalCount,
    refresh: () => {
      const lastFolder = breadcrumbPath.length > 0 ? breadcrumbPath[breadcrumbPath.length - 1] : null;
      fetchDataByCategory(currentCategory, lastFolder);
      // Also refresh approval count
      fetchApprovalCount();
    },
    handleFolderClick,
    handleBreadcrumbClick,
    navigateToBreadcrumb,
    handleCategoryChange,
  };
};

export default useFetchBuckets;