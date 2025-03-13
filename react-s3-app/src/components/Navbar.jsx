import React from "react";
import { Menu } from "antd";
import { FileOutlined, UploadOutlined, DiffOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const navigate = useNavigate();

  return (
    <Menu mode="horizontal" theme="dark" defaultSelectedKeys={["file-manager"]}>
      <Menu.Item key="file-manager" icon={<FileOutlined />} onClick={() => navigate("/")}>
        File Manager
      </Menu.Item>
      <Menu.Item key="upload-file" icon={<UploadOutlined />} onClick={() => navigate("/upload")}>
        Upload File
      </Menu.Item>
      <Menu.Item key="file-comparison" icon={<DiffOutlined />} onClick={() => navigate("/compare")}>
        File Comparison
      </Menu.Item>
    </Menu>
  );
};

export default Navbar;
