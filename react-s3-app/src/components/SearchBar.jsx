import React from "react";
import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";

const SearchBar = ({ searchQuery, onSearch }) => {
  return (
    <Input
      placeholder="Search files or folders..."
      value={searchQuery}
      onChange={(e) => onSearch(e.target.value)}
      prefix={<SearchOutlined style={{ color: "rgba(0,0,0,0.45)" }} />}
      allowClear
      style={{
        marginBottom: "10px",
        width: "100%",
        maxWidth: "400px",
        borderRadius: "6px",
        padding: "6px 10px",
      }}
    />
  );
};

export default SearchBar;
