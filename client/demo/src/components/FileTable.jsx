import React, { useState } from "react";
import { Table, Space, Tag, Dropdown, Button, Checkbox,theme } from "antd";
import {
  MoreOutlined,
  HistoryOutlined,
  DownloadOutlined,
  ShareAltOutlined,
  DeleteOutlined,
  FolderOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import FileIcon from "./FileIcon";
import ShareModal from "./ShareModal";
import ApprovalModal from "./ApprovalModal";
import api from "../utils/api";
const { useToken } = theme;

const FileTable = ({ data, onFolderClick, onVersionClick, onSelectChange ,onSuccess}) => {
  const { token } = useToken(); // Access Ant Design theme tokens for dark/light mode
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [currentSharedItem, setCurrentSharedItem] = useState(null);
  const [ApproveModalVisible, setApproveModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

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

  // Handle share click
  const handleShareClick = (record) => {
    setCurrentSharedItem(record);
    setShareModalVisible(true);
  };
  const handledelete =async (record)=>{
    if(record.isFolder){

      const response=await api.Buckets().removeBucket({
        bucketId:record.id
      })
      if(response.success){
        onSuccess()
      }
    }
    else{
      const response=await api.Items().removeItem({
        itemID:record.id
      })
      if(response.success){
        onSuccess()
      }
    }
  
  }

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
        onClick: () => handledelete(record),
      
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
                onFolderClick(record.id, record.name,record.permissionType==='write');
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
      render: (text) => <span style={{ color: token.colorTextSecondary }}>{text}</span>,
    },
    {
      title: "Size",
      dataIndex: "size",
      key: "size",
      render: (text) => <span style={{ color: token.colorTextSecondary }}>{text}</span>,
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

      
    </>
  );
};

export default FileTable;
