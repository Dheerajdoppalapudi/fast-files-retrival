import React, { useState } from "react";
import { Table, Space, Tag, Dropdown, Button, Checkbox, theme, Modal } from "antd";
import {
  MoreOutlined,
  HistoryOutlined,
  DownloadOutlined,
  ShareAltOutlined,
  DeleteOutlined,
  FolderOutlined,
  CheckCircleOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  ExclamationCircleFilled,
} from "@ant-design/icons";
import FileIcon from "./FileIcon";
import ShareModal from "./ShareModal";
import ApprovalModal from "./ApprovalModal";
import api from "../utils/api";
const { useToken } = theme;

const FileTable = ({ data, onFolderClick, onVersionClick, onSelectChange, onSuccess }) => {
  const { token } = useToken(); // Access Ant Design theme tokens for dark/light mode
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [currentSharedItem, setCurrentSharedItem] = useState(null);
  const [ApproveModalVisible, setApproveModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [sortedInfo, setSortedInfo] = useState({});
  
  // Delete confirmation states
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Helper function to determine file icon based on filename
  const getFileIcon = (fileName, isFolder) => {
    if (isFolder) return <FolderOutlined style={{ fontSize: "18px", color: "#f0c14b" }} />;
    return <FileIcon fileName={fileName} />;
  };

  // Handle row selection change
  const handleSelectionChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
    if (onSelectChange) {
      onSelectChange(newSelectedRowKeys);
    }
  };

  // Handle table change (for sorting)
  const handleTableChange = (pagination, filters, sorter) => {
    setSortedInfo(sorter);
  };

  // Handle share click
  const handleShareClick = (record) => {
    setCurrentSharedItem(record);
    setShareModalVisible(true);
  };
  
  // Show delete confirmation modal
  const showDeleteConfirm = (record) => {
    setItemToDelete(record);
    setDeleteModalVisible(true);
  };
  
  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    
    try {
      if (itemToDelete.isFolder) {
        const response = await api.Buckets().removeBucket({
          bucketId: itemToDelete.id
        });
        if (response.success) {
          onSuccess();
        }
      } else {
        const response = await api.Items().removeItem({
          itemID: itemToDelete.id
        });
        if (response.success) {
          onSuccess();
        }
      }
    } catch (error) {
      console.error("Deletion failed:", error);
    } finally {
      setDeleteModalVisible(false);
      setItemToDelete(null);
    }
  };
  
  // Handle delete cancel
  const handleDeleteCancel = () => {
    setDeleteModalVisible(false);
    setItemToDelete(null);
  };

  // Handle approval click
  const handleApprovalClick = (record) => {
    setCurrentSharedItem(record);
    setApproveModalVisible(true);
  };

  // File download function
  const downloadFile = async (version) => {
    try {
      const fileData = await api.Versions().getFileWithProgress({
        versionID: version.id,
        onProgress: (progress) => {
          console.log(`Download Progress: ${progress}%`);
        },
      });

      if (fileData?.blob) {
        const url = window.URL.createObjectURL(fileData.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = version.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        console.error("No file data received");
      }
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  // Get contextual menu options based on item type
  const getActionMenu = (record) => {
    const baseOptions = [
      record.permissionType === "write" && {
        key: "share",
        label: "Share",
        icon: <ShareAltOutlined />,
        onClick: () => handleShareClick(record),
      },
      record.isOwner && {
        key: "delete",
        label: "Delete",
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () => showDeleteConfirm(record),
      },
      record.isApprover && {
        key: "approval",
        label: "Approval",
        icon: <CheckCircleOutlined />,
        onClick: () => handleApprovalClick(record),
      },
    ];

    if (!record.isFolder) {
      baseOptions.unshift({
        key: "download",
        label: "Download",
        icon: <DownloadOutlined />,
        onClick: () => downloadFile(record.latestversion),
      });

      if (record.hasVersions) {
        baseOptions.splice(2, 0, {
          key: "versions",
          label: "Version History",
          icon: <HistoryOutlined />,
          onClick: () => onVersionClick(record),
        });
      }
    }

    return baseOptions.filter(Boolean); // Remove undefined items
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => {
        // Sort folders before files
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        
        // Then sort alphabetically
        return a.name.localeCompare(b.name);
      },
      sortOrder: sortedInfo.columnKey === "name" && sortedInfo.order,
      render: (text, record) => (
        <Space>
          {getFileIcon(text, record.isFolder)}
          <span
            style={{
              color: token.colorText,
              cursor: "pointer",
              fontWeight: record.isFolder ? "500" : "normal",
            }}
            onClick={() => {
              if (record.isFolder) {
                onFolderClick(record.id, record.name, record.permissionType === 'write');
              } else if (record.hasVersions || record.versions.length > 0) {
                onVersionClick(record);
              }
            }}
          >
            {text}
          </span>
          {record.hasVersions && !record.isFolder && (
            <Tag
              color={token.colorPrimary}
              icon={<HistoryOutlined />}
              style={{ cursor: "pointer" }}
              onClick={() => onVersionClick(record)}
            >
              {record.versions?.length || 0} versions
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Modified",
      dataIndex: "modified",
      key: "modified",
      sorter: (a, b) => {
        // Convert string dates to Date objects for proper comparison
        const dateA = new Date(a.modified);
        const dateB = new Date(b.modified);
        return dateA - dateB;
      },
      sortOrder: sortedInfo.columnKey === "modified" && sortedInfo.order,
      render: (text) => <span style={{ color: token.colorTextSecondary }}>{text}</span>,
    },
    {
      title: "Owner",
      dataIndex: "owner",
      key: "owner",
      sorter: (a, b) => {
        const nameA = a.owner.isOwner ? "You" : a.owner.username;
        const nameB = b.owner.isOwner ? "You" : b.owner.username;
        return nameA.localeCompare(nameB);
      },
      sortOrder: sortedInfo.columnKey === "owner" && sortedInfo.order,
      render: (text) => (
        <span style={{ color: token.colorTextSecondary }}>
          {text.isOwner ? "You" : text.username.charAt(0).toUpperCase() + text.username.slice(1)}
        </span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_, record) => (
        <Dropdown
          menu={{ items: getActionMenu(record) }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <Button
            type="text"
            icon={<MoreOutlined />}
            style={{ color: token.colorTextSecondary }}
          />
        </Dropdown>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: handleSelectionChange,
    columnWidth: 48,
    renderCell: (checked, record, index, originNode) => (
      <Checkbox
        checked={checked}
        style={{
          borderColor: checked ? token.colorPrimary : "#6e6e6e",
          cursor: "pointer",
        }}
      />
    ),
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      Table.SELECTION_NONE,
    ],
    columnTitle: (
      <Checkbox
        indeterminate={
          selectedRowKeys.length > 0 && selectedRowKeys.length < data.length
        }
        checked={data.length > 0 && selectedRowKeys.length === data.length}
        onChange={(e) => {
          if (e.target.checked) {
            handleSelectionChange(data.map((item) => item.key || item.id));
          } else {
            handleSelectionChange([]);
          }
        }}
        style={{
          borderColor: selectedRowKeys.length > 0 ? token.colorPrimary : "#6e6e6e",
        }}
      />
    ),
  };

  return (
    <>
      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={data.map((item) => ({
          ...item,
          key: item.key || item.id, // Ensure each row has a key property
        }))}
        pagination={false}
        rowClassName={(record) =>
          selectedRowKeys.includes(record.key || record.id)
            ? "dark-table-row selected-row"
            : "dark-table-row"
        }
        size="middle"
        style={{ backgroundColor: "transparent" }}
        className="dark-mode-table"
        showHeader={true}
        headerBorderRadius={0}
        tableLayout="fixed"
        locale={{ emptyText: "No items in this location" }}
        onChange={handleTableChange}
        onRow={(record) => ({
          onClick: (event) => {
            if (event.target.tagName === "SPAN" && event.target.style.cursor === "pointer") {
              return;
            }

            if (
              event.target.tagName === "BUTTON" ||
              event.target.closest("button") ||
              event.target.closest(".ant-dropdown-trigger")
            ) {
              return;
            }

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
            borderBottom: `1px solid ${token.colorBorder}`,
            backgroundColor: selectedRowKeys.includes(record.key || record.id)
              ? token.colorPrimaryBackground
              : token.colorBgBase,
            transition: "background-color 0.3s",
          },
        })}
      />

      {/* Modals for share and approval */}
      <ShareModal
        visible={shareModalVisible}
        item={currentSharedItem}
        onClose={() => setShareModalVisible(false)}
      />
      <ApprovalModal
        visible={ApproveModalVisible}
        item={currentSharedItem}
        onClose={() => setApproveModalVisible(false)}
      />
      
      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ExclamationCircleFilled style={{ color: '#ff4d4f', marginRight: '8px' }} />
            <span>Confirm Delete</span>
          </div>
        }
        open={deleteModalVisible}
        onOk={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        okText="Delete"
        cancelText="Cancel"
        okButtonProps={{ danger: true }}
      >
        <p>
          Are you sure you want to delete{' '}
          <strong>{itemToDelete?.name}</strong>?
          {itemToDelete?.isFolder ? ' This will delete all files inside the folder.' : ''}
        </p>
        <p>This action cannot be undone.</p>
      </Modal>
    </>
  );
};

export default FileTable;