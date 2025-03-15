import React, { useState } from 'react';
import { Table, Space, Tag, Dropdown, Button, Checkbox } from 'antd';
import { 
  MoreOutlined, 
  HistoryOutlined, 
  DownloadOutlined, 
  ShareAltOutlined, 
  DeleteOutlined,
  FolderOutlined,
} from '@ant-design/icons';

import FileIcon from './FileIcon';
import ShareModal from './ShareModal';

const FileTable = ({ data, onFolderClick, onVersionClick, onSelectChange }) => {
  // State for share modal
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [currentSharedItem, setCurrentSharedItem] = useState(null);


  
  // State for row selection
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // Helper function to determine file icon based on filename
  const getFileIcon = (fileName, isFolder) => {
    if (isFolder) return <FolderOutlined style={{ fontSize: '18px', color: '#f0c14b' }} />;
    return <FileIcon fileName={fileName} />;
  };

  // Function to open share modal
  const handleShareClick = (record) => {
    setCurrentSharedItem(record);
    setShareModalVisible(true);
  };

  // Handle row selection change
  const handleSelectionChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
    
    // If there's a parent component handler, call it too
    if (onSelectChange) {
      onSelectChange(newSelectedRowKeys);
    }
  };

  // Get contextual menu options based on item type
  const getActionMenu = (record) => {
    const baseOptions = [
      {
        key: 'share',
        label: 'Share',
        icon: <ShareAltOutlined />,
        onClick: () => handleShareClick(record),
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: <DeleteOutlined />,
        danger: true,
      },
    ];
    
    // For files only
    if (!record.isFolder) {
      baseOptions.unshift({
        key: 'download',
        label: 'Download',
        icon: <DownloadOutlined />,
      });
      
      // Version history only for files with versions
      if (record.hasVersions) {
        baseOptions.splice(2, 0, {
          key: 'versions',
          label: 'Version History',
          icon: <HistoryOutlined />,
          onClick: () => onVersionClick(record),
        });
      }
    }
    
    return baseOptions;
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {getFileIcon(text, record.isFolder)}
          <span
            style={{ 
              color: 'white', 
              cursor: 'pointer',
              fontWeight: record.isFolder ? '500' : 'normal'
            }}
            onClick={() => {
              if (record.isFolder) {
                onFolderClick(record.id, record.name);
              } else if (record.hasVersions) {
                onVersionClick(record);
              }
            }}
          >
            {text}
          </span>
          {record.hasVersions && !record.isFolder && (
            <Tag
              color="#1890ff"
              icon={<HistoryOutlined />}
              style={{ cursor: 'pointer' }}
              onClick={() => onVersionClick(record)}
            >
              {record.versions?.length || 0} versions
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Modified',
      dataIndex: 'modified',
      key: 'modified',
      render: (text) => <span style={{ color: '#cccccc' }}>{text}</span>,
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      render: (text) => <span style={{ color: '#cccccc' }}>{text}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Dropdown menu={{ items: getActionMenu(record) }} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<MoreOutlined />} style={{ color: '#e6e6e6' }} />
        </Dropdown>
      ),
    },
  ];

  // Improved row selection configuration
  const rowSelection = {
    selectedRowKeys,
    onChange: handleSelectionChange,
    columnWidth: 48,
    renderCell: (checked, record, index, originNode) => {
      return (
        <Checkbox
          checked={checked}
          style={{ 
            borderColor: checked ? '#1890ff' : '#6e6e6e',
            cursor: 'pointer'
          }}
        />
      );
    },
    // Add select all configuration
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      Table.SELECTION_NONE,
    ],
    // Ensure checkbox is properly styled in dark mode
    columnTitle: (
      <Checkbox
        indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < data.length}
        checked={data.length > 0 && selectedRowKeys.length === data.length}
        onChange={(e) => {
          if (e.target.checked) {
            // Select all rows
            handleSelectionChange(data.map(item => item.key || item.id));
          } else {
            // Clear selection
            handleSelectionChange([]);
          }
        }}
        style={{ 
          borderColor: selectedRowKeys.length > 0 ? '#1890ff' : '#6e6e6e' 
        }}
      />
    ),
  };

  return (
    <>
      <Table 
        rowSelection={rowSelection}
        columns={columns} 
        dataSource={data.map(item => ({
          ...item,
          key: item.key || item.id, // Ensure each row has a key property
        }))} 
        pagination={false}
        rowClassName={(record) => 
          selectedRowKeys.includes(record.key || record.id) ? 'dark-table-row selected-row' : 'dark-table-row'
        }
        size="middle"
        style={{ backgroundColor: 'transparent' }}
        className="dark-mode-table"
        showHeader={true}
        headerBorderRadius={0}
        tableLayout="fixed"
        locale={{ emptyText: 'No items in this location' }}
        onRow={(record) => ({
          onClick: (event) => {
            // Don't toggle selection when clicking on elements that have their own click handlers
            if (
              event.target.tagName === 'SPAN' && 
              event.target.style.cursor === 'pointer'
            ) {
              return;
            }
            
            // Don't toggle when clicking action buttons
            if (
              event.target.tagName === 'BUTTON' || 
              event.target.closest('button') || 
              event.target.closest('.ant-dropdown-trigger')
            ) {
              return;
            }
            
            // Toggle selection for this row
            const key = record.key || record.id;
            const selectedIndex = selectedRowKeys.indexOf(key);
            const newSelectedRowKeys = [...selectedRowKeys];
            
            if (selectedIndex >= 0) {
              newSelectedRowKeys.splice(selectedIndex, 1);
            } else {
              newSelectedRowKeys.push(key);
            }
            
            handleSelectionChange(newSelectedRowKeys);
          },
          style: { 
            borderBottom: '1px solid #333',
            backgroundColor: selectedRowKeys.includes(record.key || record.id) ? '#2a3f5f' : '#1a1a1a',
            transition: 'background-color 0.3s'
          },
          onMouseEnter: (e) => {
            if (!selectedRowKeys.includes(record.key || record.id)) {
              e.currentTarget.style.backgroundColor = '#222';
            }
          },
          onMouseLeave: (e) => {
            if (!selectedRowKeys.includes(record.key || record.id)) {
              e.currentTarget.style.backgroundColor = '#1a1a1a';
            }
          }
        })}
      />

      {/* Import the ShareModal component */}
      <ShareModal 
        visible={shareModalVisible}
        item={currentSharedItem}
        onClose={() => setShareModalVisible(false)}
      />

      {/* Add some CSS to improve selection visibility */}
      <style jsx global>{`
        .dark-mode-table .selected-row {
          background-color: #2a3f5f !important;
        }
        
        .dark-mode-table .ant-table-cell-row-hover {
          background-color: #222 !important;
        }
        
        .dark-mode-table .selected-row:hover {
          background-color: #2a3f5f !important;
        }
        
        .dark-mode-table .ant-checkbox-wrapper .ant-checkbox-inner {
          background-color: transparent;
          border-color: #6e6e6e;
        }
        
        .dark-mode-table .ant-checkbox-wrapper .ant-checkbox-checked .ant-checkbox-inner {
          background-color: #1890ff;
          border-color: #1890ff;
        }
        
        .dark-mode-table .ant-table-selection-column {
          padding-left: 16px;
        }
        
        .dark-mode-table .ant-table-selection-extra {
          color: #e6e6e6;
        }
      `}</style>
    </>
  );
};

export default FileTable;