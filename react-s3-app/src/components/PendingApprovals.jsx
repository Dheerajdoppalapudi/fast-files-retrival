import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { Table, Button, Space, Typography, Tag, message } from "antd";
import { AuthContext } from "../context/AuthContext";

const { Title } = Typography;

const PendingApprovals = ({ userId }) => {
  const [files, setFiles] = useState([]);

  const { user } = useContext(AuthContext);
  if (user) {
    console.log("Logged-in user:", user.username, "Role:", user.role);
  }


  useEffect(() => {
    fetchPendingFiles();
  }, []);

  const fetchPendingFiles = async () => {
    try {
      const response = await axios.get(`http://localhost:8000/files/pending-files/${userId}`);
      setFiles(response.data);
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  };

  const handleApprove = async (fileId) => {
    try {
      await axios.patch(`http://localhost:8000/files/approve/${fileId}`);
      message.success("File approved!");
      fetchPendingFiles(); // Refresh the list
    } catch (error) {
      console.error("Approval failed:", error);
    }
  };

  const handleReject = async (fileId) => {
    try {
      await axios.patch(`http://localhost:8000/files/reject/${fileId}`);
      message.error("File rejected.");
      fetchPendingFiles();
    } catch (error) {
      console.error("Rejection failed:", error);
    }
  };

  const columns = [
    {
      title: "File Name",
      dataIndex: "filename",
      key: "filename",
    },
    {
      title: "Group Name",
      dataIndex: "group_name",
      key: "group_name",
    },
    {
      title: "Uploader ID",
      dataIndex: "uploaded_by",
      key: "uploaded_by",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => <Tag color="orange">{status}</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button type="primary" onClick={() => handleApprove(record.id)}>
            Approve
          </Button>
          <Button danger onClick={() => handleReject(record.id)}>
            Reject
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>Pending File Approvals  - {user.username}</Title>
      <Table columns={columns} dataSource={files} rowKey="id" />
    </div>
  );
};

export default PendingApprovals;
