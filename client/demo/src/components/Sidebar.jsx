import React from 'react';
import { Menu, Layout } from 'antd';
import {
  FolderOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FileOutlined,
  HistoryOutlined,
  ShareAltOutlined,
  StarOutlined,
  DeleteOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

const Sidebar = ({ onCategoryClick }) => {
  const sidebarItems = [
    { key: 'All files', icon: <FolderOutlined style={{ color: '#1890ff' }} />, title: 'All files' },
    { key: 'Documents', icon: <FileTextOutlined />, title: 'Documents' },
    { key: 'PDFs', icon: <FilePdfOutlined />, title: 'PDFs' },
    { key: 'Spreadsheets', icon: <FileExcelOutlined />, title: 'Spreadsheets' },
    { key: 'Word Files', icon: <FileWordOutlined />, title: 'Word Files' },
    { key: 'Other', icon: <FileOutlined />, title: 'Other' },
    { key: 'Version History', icon: <HistoryOutlined />, title: 'Version History' },
  ];

  return (
    <Sider width={200} style={{ backgroundColor: '#121212', borderRight: '1px solid #333' }}>
      <Menu
        mode="inline"
        selectedKeys={['All files']}
        style={{ backgroundColor: '#121212', borderRight: 0 }}
        onClick={(item) => {
          if (item.key === 'All files') {
            onCategoryClick();
          }
        }}
      >
        {sidebarItems.map(item => (
          <Menu.Item key={item.key} icon={item.icon} style={{ backgroundColor: '#121212', color: '#e6e6e6' }}>
            {item.title}
          </Menu.Item>
        ))}
        <Menu.Divider style={{ backgroundColor: '#333', margin: '10px 0' }} />
        <Menu.Item key="Share" icon={<ShareAltOutlined />} style={{ backgroundColor: '#121212', color: '#e6e6e6' }}>
          Share
        </Menu.Item>
        <Menu.Item key="Starred" icon={<StarOutlined />} style={{ backgroundColor: '#121212', color: '#e6e6e6' }}>
          Starred
        </Menu.Item>
        <Menu.Item key="Recycle Bin" icon={<DeleteOutlined />} style={{ backgroundColor: '#121212', color: '#e6e6e6' }}>
          Recycle Bin
        </Menu.Item>
      </Menu>
    </Sider>
  );
};

export default Sidebar;