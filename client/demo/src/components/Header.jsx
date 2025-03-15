import React from 'react';
import { Layout, Button, Typography, Dropdown, Menu } from 'antd';
import { FileOutlined, BellOutlined, GlobalOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../utils/auth';

const { Header } = Layout;
const { Title } = Typography;

const AppHeader = () => {
  const { logout, user } = useAuth();

  const handleMenuClick = (e) => {
    if (e.key === 'logout') {
      logout();
    }
  };

  const menu = (
    <Menu onClick={handleMenuClick}>
      <Menu.Item key="profile">Profile</Menu.Item>
      <Menu.Item key="logout">Logout</Menu.Item>
    </Menu>
  );

  return (
    <Header style={{ display: 'flex', alignItems: 'center', padding: '0 20px', backgroundColor: '#121212', borderBottom: '1px solid #333' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ padding: '4px', borderRadius: '4px', marginRight: '8px' }}>
          <FileOutlined style={{ color: 'white', fontSize: '20px' }} />
        </div>
        <Title level={4} style={{ margin: 0, color: 'white' }}>Versiony</Title>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
        <Button type="text" style={{ color: '#e6e6e6' }}>
          <BellOutlined />
        </Button>
        <Button type="text" style={{ color: '#e6e6e6', marginLeft: '10px' }}>
          <GlobalOutlined />
        </Button>
        <Dropdown overlay={menu} trigger={['click']}>
          <Button type="text" style={{ color: '#e6e6e6', marginLeft: '10px' }}>
            <UserOutlined />
          </Button>
        </Dropdown>
      </div>
    </Header>
  );
};

export default AppHeader;