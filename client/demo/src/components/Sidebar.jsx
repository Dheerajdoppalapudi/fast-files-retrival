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

const Sidebar = ({ onCategoryClick,selectedKeys }) => {
  console.log(selectedKeys)
  const sidebarItems = [
    { key: 'All files', icon: <FolderOutlined  />, title: 'All files' },
    { key: 'txt', icon: <FileTextOutlined />, title: 'Documents' },
    { key: 'pdf', icon: <FilePdfOutlined />, title: 'PDFs' },
    { key: 'Spreadsheets', icon: <FileExcelOutlined />, title: 'Spreadsheets' },
    { key: 'docx', icon: <FileWordOutlined />, title: 'Word Files' },
    { key: 'Other', icon: <FileOutlined />, title: 'Other' },
    { key: 'Version History', icon: <HistoryOutlined />, title: 'Version History' },
  ];



  return (
    <Sider width={200} style={{ backgroundColor: '#121212', borderRight: '1px solid #333' }}>
      <Menu
        mode="inline"
        // defaultSelectedKeys={['All files']}
        selectedKeys={[selectedKeys.key]}
        style={{ backgroundColor: '#121212', borderRight: 0 }}
        onClick={(item) => {
          const clickedItem = sidebarItems.find(it=> it.key === item.key);
          onCategoryClick(clickedItem); // Pass the selected category key
        }}
      >
        {sidebarItems.map(item => (
          <Menu.Item key={item.key}  icon={item.icon}  style={{ 
            color: selectedKeys.key === item.key ? ' #1890ff ' : '#e6e6e6',
            fontWeight: selectedKeys.key === item.key ? 'bold' : 'normal',
          }}>
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