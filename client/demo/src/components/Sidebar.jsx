import React from 'react';
import { Menu, Layout,theme } from 'antd';
import {
  FolderOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FileOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { useToken } = theme;

const { Sider } = Layout;

const Sidebar = ({ onCategoryClick, selectedKeys }) => {
  const { token } = useToken(); // Accessing the theme token

  const sidebarItems = [
    { key: 'All files', icon: <FolderOutlined />, title: 'All files' },
    { key: 'txt', icon: <FileTextOutlined />, title: 'Documents' },
    { key: 'pdf', icon: <FilePdfOutlined />, title: 'PDFs' },
    { key: 'Spreadsheets', icon: <FileExcelOutlined />, title: 'Spreadsheets' },
    { key: 'docx', icon: <FileWordOutlined />, title: 'Word Files' },
    { key: 'PPTX', icon: <HistoryOutlined />, title: 'PPTX' },
    { key: 'Other', icon: <FileOutlined />, title: 'Other' },
    // { key: 'Share', icon: <ShareAltOutlined />, title: 'Share' },
    // { key: 'Starred', icon: <StarOutlined />, title: 'Starred' },
    { key: 'Approval', icon: <CheckCircleOutlined />, title: 'Approval' },
  ];

  // Split the sidebarItems into two parts
  const itemsBeforeDivider = sidebarItems.slice(0, sidebarItems.length - 1);
  const itemsAfterDivider = sidebarItems.slice(sidebarItems.length - 1);

  return (
    <Sider width={200} style={{ backgroundColor: token.colorBgBase, borderRight: `1px solid ${token.colorBorder}` }}>
      <Menu
        mode="inline"
        selectedKeys={[selectedKeys.key]}
        style={{
          backgroundColor: token.colorBgBase,
          borderRight: 0,
          color: token.colorText,
        }}
        onClick={(item) => {
          const clickedItem = sidebarItems.find((it) => it.key === item.key);
          onCategoryClick(clickedItem); // Pass the selected category key
        }}
      >
        {/* Render items before the divider */}
        {itemsBeforeDivider.map((item) => (
          <Menu.Item
            key={item.key}
            icon={item.icon}
            style={{
              color: selectedKeys.key === item.key ? token.colorPrimary : token.colorTextSecondary,
              fontWeight: selectedKeys.key === item.key ? 'bold' : 'normal',
            }}
          >
            {item.title}
          </Menu.Item>
        ))}

        {/* Render the divider */}
        <Menu.Divider style={{ backgroundColor: token.colorBorder, margin: '10px 0' }} />

        {/* Render items after the divider */}
        {itemsAfterDivider.map((item) => (
          <Menu.Item
            key={item.key}
            icon={item.icon}
            style={{
              color: selectedKeys.key === item.key ? token.colorPrimary : token.colorTextSecondary,
              fontWeight: selectedKeys.key === item.key ? 'bold' : 'normal',
            }}
          >
            {item.title}
          </Menu.Item>
        ))}
      </Menu>
    </Sider>
  );
};

export default Sidebar;
