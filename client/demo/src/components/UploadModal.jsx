import React, { useState } from 'react';
import { Modal, Upload, Button, Progress, Typography, Input, theme } from 'antd';
import { InboxOutlined, UploadOutlined } from '@ant-design/icons';

const { useToken } = theme;
const { Dragger } = Upload;
const { Text } = Typography;
const { TextArea } = Input;

const UploadModal = ({ 
  visible, 
  onCancel, 
  uploading, 
  uploadProgress, 
  fileList, 
  onFileListChange,
  onUpload,
  currentBucketID,
  breadcrumbPath
}) => {
  // Get the current theme token
  const { token } = useToken();
  
  // State for the note input
  const [note, setNote] = useState('');

  // Generate current location text for the modal
  const getLocationText = () => {
    if (!currentBucketID) {
      return "Root directory";
    }
    if (breadcrumbPath && breadcrumbPath.length > 0) {
      return breadcrumbPath.map(item => item.name).join(' / ');
    }
    return currentBucketID;
  };

  // Props for the Dragger component
  const uploadProps = {
    name: 'file',
    multiple: true,
    fileList,
    onChange: onFileListChange,
    beforeUpload: (file) => false, // Prevent auto-upload
    onDrop: (e) => console.log('Dropped files', e.dataTransfer.files),
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
        <Button key="cancel" onClick={onCancel} disabled={uploading} style={{ color: token.colorText }}>
          Cancel
        </Button>,
        <Button
          key="upload"
          type="primary"
          onClick={() => {
            onUpload(currentBucketID, note);
            setNote("")
          }}
          loading={uploading}
          icon={<UploadOutlined />}
          disabled={fileList.length === 0}
          style={{
            backgroundColor: token.colorPrimary,
            borderColor: token.colorPrimary,
            color: token.colorTextInverse
          }}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      ]}
      width={600}
      bodyStyle={{ 
        backgroundColor: token.colorBgBase, 
        padding: '20px',
        borderRadius: '4px'
      }}
      style={{ color: token.colorText }}
    >
      <div style={{ marginBottom: '16px' }}>
        <Text style={{ color: token.colorText }}>
          Upload to: <Text strong style={{ color: token.colorTextHeading }}>{getLocationText()}</Text>
        </Text>
      </div>

      <Dragger 
        {...uploadProps}
        style={{ 
          backgroundColor: token.colorBgContainer, 
          borderColor: token.colorBorder,
          borderStyle: 'dashed',
          borderRadius: '4px'
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ color: token.colorPrimary, fontSize: '48px' }} />
        </p>
        <p className="ant-upload-text" style={{ color: token.colorText }}>
          Click or drag files to this area to upload
        </p>
        <p className="ant-upload-hint" style={{ color: token.colorTextSecondary }}>
          Support for a single or bulk upload. Strictly prohibited from uploading company data or other banned files.
        </p>
      </Dragger>

      {uploading && (
        <div style={{ marginTop: '16px' }}>
          <Progress 
            percent={uploadProgress} 
            status="active" 
            strokeColor={{
              '0%': token.colorPrimary,
              '100%': token.colorSuccess,
            }}
          />
          <div style={{ textAlign: 'center', marginTop: '8px', color: token.colorTextSecondary }}>
            Uploading... {uploadProgress}%
          </div>
        </div>
      )}

      {fileList.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <Text style={{ color: token.colorText }}>
            {fileList.length} file(s) selected
          </Text>
        </div>
      )}

      {/* Note Input */}
      <div style={{ marginTop: '16px' }}>
        <Text style={{ color: token.colorText }}>Add a Note (Optional):</Text>
        <TextArea
          rows={3}
          placeholder="Enter a note for this upload..."
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
          style={{ marginTop: '8px', color: token.colorText, backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}
        />
      </div>
    </Modal>
  );
};

export default UploadModal;
