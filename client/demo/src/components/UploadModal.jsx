import React from 'react';
import { Modal, Upload, Button, Progress, Typography } from 'antd';
import { InboxOutlined, UploadOutlined } from '@ant-design/icons';

const { Dragger } = Upload;
const { Text } = Typography;

const UploadModal = ({ 
  visible, 
  onCancel, 
  uploading, 
  uploadProgress, 
  fileList, 
  onFileListChange,
  onUpload,
  currentBucketName,
  breadcrumbPath
}) => {
  // Generate current location text for the modal
  const getLocationText = () => {
    if (!currentBucketName) {
      return "Root directory";
    }
    
    if (breadcrumbPath && breadcrumbPath.length > 0) {
      // Format the breadcrumb path for display
      return breadcrumbPath.map(item => item.name).join(' / ');
    }
    
    return currentBucketName;
  };
  
  // Props for the Dragger component
  const uploadProps = {
    name: 'file',
    multiple: true,
    fileList,
    onChange: onFileListChange,
    beforeUpload: (file) => {
      // Just return false to prevent auto upload
      return false;
    },
    onDrop: (e) => {
      console.log('Dropped files', e.dataTransfer.files);
    },
    disabled: uploading,
  };

  return (
    <Modal
      title="Upload Files"
      open={visible}
      onCancel={uploading ? null : onCancel}
      closable={!uploading}
      maskClosable={!uploading}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={uploading}>
          Cancel
        </Button>,
        <Button
          key="upload"
          type="primary"
          onClick={() => onUpload(currentBucketName)}
          loading={uploading}
          icon={<UploadOutlined />}
          disabled={fileList.length === 0}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      ]}
      width={600}
      bodyStyle={{ 
        backgroundColor: '#1a1a1a', 
        padding: '20px',
        borderRadius: '4px'
      }}
      style={{ color: '#e6e6e6' }}
    >
      <div style={{ marginBottom: '16px' }}>
        <Text style={{ color: '#e6e6e6' }}>
          Upload to: <Text strong style={{ color: 'white' }}>{getLocationText()}</Text>
        </Text>
      </div>
      
      <Dragger 
        {...uploadProps}
        style={{ 
          backgroundColor: '#2a2a2a', 
          borderColor: '#444',
          borderStyle: 'dashed',
          borderRadius: '4px'
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ color: '#1890ff', fontSize: '48px' }} />
        </p>
        <p className="ant-upload-text" style={{ color: 'white' }}>
          Click or drag files to this area to upload
        </p>
        <p className="ant-upload-hint" style={{ color: '#aaa' }}>
          Support for a single or bulk upload. Strictly prohibited from uploading company data or other banned files.
        </p>
      </Dragger>
      
      {uploading && (
        <div style={{ marginTop: '16px' }}>
          <Progress 
            percent={uploadProgress} 
            status="active" 
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <div style={{ textAlign: 'center', marginTop: '8px', color: '#aaa' }}>
            Uploading... {uploadProgress}%
          </div>
        </div>
      )}
      
      {fileList.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <Text style={{ color: '#e6e6e6' }}>
            {fileList.length} file(s) selected
          </Text>
        </div>
      )}
    </Modal>
  );
};

export default UploadModal;