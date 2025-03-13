import React, { useContext } from "react";
import { Menu, Button } from "antd";
import { FileOutlined, UploadOutlined, DiffOutlined, LogoutOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useContext(AuthContext);

  // Set the active menu item based on the current route
  const selectedKey = location.pathname === "/" ? "file-manager" : location.pathname.slice(1);

  return (
    <Menu mode="horizontal" theme="dark" selectedKeys={[selectedKey]}>
      <Menu.Item key="file-manager" icon={<FileOutlined />} onClick={() => navigate("/")}>
        File Manager
      </Menu.Item>
      <Menu.Item key="upload" icon={<UploadOutlined />} onClick={() => navigate("/upload")}>
        Upload File
      </Menu.Item>
      <Menu.Item key="compare" icon={<DiffOutlined />} onClick={() => navigate("/compare")}>
        File Comparison
      </Menu.Item>
      <Menu.Item key="logout" style={{ marginLeft: "auto" }}>
        <Button type="text" icon={<LogoutOutlined />} onClick={() => { logout(); navigate("/login"); }} style={{ color: "white" }}>
          Logout
        </Button>
      </Menu.Item>
    </Menu>
  );
};

export default Navbar;
