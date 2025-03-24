import { useState } from 'react';
import api from '../utils/api';
import { message } from 'antd';
const useFileUpload = (onUploadComplete) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [fileList, setFileList] = useState([]);
  
 
  const showUploadModal = () => {
    setFileList([]);
    setUploadProgress(0);
    setUploadModalVisible(true);
  };
  
 
  const hideUploadModal = () => {
    setUploadModalVisible(false);
    setFileList([]);
    setUploadProgress(0);
  };
  
  
  const handleFileListChange = ({ fileList }) => {
    // Limit list to only files being uploaded
    const newFileList = fileList.map(file => {
      // Remove file from list if it was previously uploaded or has error
      if (file.status === 'done' || file.status === 'error') {
        return null;
      }
      return file;
    }).filter(Boolean);
    
    setFileList(newFileList);
  };
  
 
  const uploadFileWithProgress = async ({ notes,file, currentBucketID = null, onProgress = () => {} }) => {
    return await api.Items().uploadFileWithProgress({
      
        notes:notes,
        file:file,
        currentBucketID:currentBucketID,
        onProgress:onProgress
    })
  };
  

  const uploadFiles = async (currentBucketID = null,notes="") => {
    if (!fileList.length) {
      message.warning('Please select at least one file to upload');
      return;
    }
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const totalFiles = fileList.length;
      let completedFiles = 0;
      const results = [];
      
      // Process files one by one to track individual progress
      for (const fileItem of fileList) {
        const file = fileItem.originFileObj;
        
        try {
          // Upload individual file with progress tracking
          const result = await uploadFileWithProgress({
            notes:notes,
            file,
            currentBucketID: currentBucketID,
            onProgress: (percent) => {
              // Calculate overall progress as combination of completed files and current file progress
              const overallProgress = Math.floor((completedFiles / totalFiles) * 100) + 
                                     Math.floor((percent / totalFiles));
              setUploadProgress(Math.min(overallProgress, 99)); // Cap at 99% until fully complete
            }
          });
          
          results.push(result);
          completedFiles++;
        } catch (error) {
          message.error(`Failed to upload ${file.name}`);
        }
      }
      
      setUploadProgress(100);
      message.success(`${completedFiles} of ${totalFiles} file(s) uploaded successfully`);
      
      // Reset state
      setFileList([]);
      setUploadModalVisible(false);
      
      // Call completion callback if provided
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Error during file upload:', error);
      message.error('Upload process encountered an error');
    } finally {
      setUploading(false);
    }
  };
  
  /**
   * Handle drag and drop file uploads
   * @param {Object} event - Drop event
   * @param {String|null} bucketName - Target bucket name
   */
  const handleFileDrop = async (event, bucketName = null,notes="") => {
    event.preventDefault();
    
    
    // Extract files from drop event
    const droppedFiles = Array.from(event.dataTransfer.files);
    
    if (droppedFiles.length === 0) {
      return;
    }
    
    // Upload the dropped files one by one
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const totalFiles = droppedFiles.length;
      let completedFiles = 0;
      
      for (const file of droppedFiles) {
        try {
          await uploadFileWithProgress({
            notes:notes,
            file,
            bucketName,
            onProgress: (percent) => {
              const overallProgress = Math.floor((completedFiles / totalFiles) * 100) + 
                                     Math.floor((percent / totalFiles));
              setUploadProgress(Math.min(overallProgress, 99));
            }
          });
          
          completedFiles++;
        } catch (error) {
          message.error(`Failed to upload ${file.name}`);
        }
      }
      
      setUploadProgress(100);
      message.success(`${completedFiles} of ${totalFiles} file(s) uploaded successfully`);
      
      // Call completion callback if provided
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Error uploading dropped files:', error);
      message.error('Upload process encountered an error');
    } finally {
      setUploading(false);
    }
  };
  
  return {
    uploading,
    uploadProgress,
    fileList,
    uploadModalVisible,
    showUploadModal,
    hideUploadModal,
    handleFileListChange,
    uploadFiles,
    handleFileDrop,
    uploadFileWithProgress
  };
};

export default useFileUpload;