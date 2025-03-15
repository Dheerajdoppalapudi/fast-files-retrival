import React from "react";
import { Breadcrumb } from "antd";

const BreadcrumbNav = ({ currentPath, onNavigate }) => {
  return (
    <Breadcrumb style={{ marginBottom: "16px", fontSize: "14px" }}>
      <Breadcrumb.Item>
        <span
          style={{
            cursor: "pointer",
            transition: "color 0.2s ease-in-out",
          }}
          onClick={() => onNavigate(0)}
          onMouseEnter={(e) => (e.target.style.color = "#1890ff")}
          onMouseLeave={(e) => (e.target.style.color = "inherit")}
        >
          Home
        </span>
      </Breadcrumb.Item>
      {currentPath.map((folder, index) => (
        <Breadcrumb.Item key={index}>
          <span
            style={{
              cursor: "pointer",
              transition: "color 0.2s ease-in-out",
            }}
            onClick={() => onNavigate(index + 1)}
            onMouseEnter={(e) => (e.target.style.color = "#1890ff")}
            onMouseLeave={(e) => (e.target.style.color = "inherit")}
          >
            {folder}
          </span>
        </Breadcrumb.Item>
      ))}
    </Breadcrumb>
  );
};

export default BreadcrumbNav;
