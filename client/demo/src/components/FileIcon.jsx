import React from 'react';
import {
  FolderOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  FileOutlined,
} from '@ant-design/icons';

const FileIcon = ({ fileName }) => {
  if (!fileName.includes('.')) {
    return <FolderOutlined style={{ color: '#f9c22e', fontSize: '20px' }} />;
  }

  const extension = fileName.split('.').pop().toLowerCase();
  if (['xlsx', 'xls'].includes(extension)) {
    return <FileExcelOutlined style={{ color: '#3ba55c', fontSize: '20px' }} />;
  } else if (['docx', 'doc'].includes(extension)) {
    return <FileWordOutlined style={{ color: '#3b88c3', fontSize: '20px' }} />;
  } else if (['pdf'].includes(extension)) {
    return <FilePdfOutlined style={{ color: '#e74c3c', fontSize: '20px' }} />;
  } else if (['pptx', 'ppt'].includes(extension)) {
    return <FileOutlined style={{ color: '#f39c12', fontSize: '20px' }} />;
  }
  return <FileOutlined style={{ color: '#bbb', fontSize: '20px' }} />;
};

export default FileIcon;