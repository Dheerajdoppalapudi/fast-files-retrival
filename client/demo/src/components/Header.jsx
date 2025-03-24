import React from 'react';
import { Layout, Button, Typography, Dropdown, Menu, theme } from 'antd';
import { FileOutlined, BellOutlined, BulbFilled, BulbOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../utils/auth';

const { Header } = Layout;
const { Title } = Typography;
const { useToken } = theme;

const AppHeader = ({ toggleTheme, isDarkMode }) => {
  const { logout, user } = useAuth();
  const { token } = useToken();

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
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        backgroundColor: token.colorBgBase,  // Automatically sets the background color
        borderBottom: `1px solid ${token.colorBorder}`,  // Automatically sets border color
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ padding: '4px', borderRadius: '4px', marginRight: '8px' }}>
          <FileOutlined style={{ color: token.colorText, fontSize: '20px' }} /> {/* Text and icon colors */}
        </div>
        <Title level={4} style={{ margin: 0, color: token.colorText }}>DocHub</Title>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
        <Button
          type="text"
          icon={isDarkMode ? <BulbOutlined /> : <BulbFilled />}
          onClick={toggleTheme}
          style={{
            color: token.colorText,  // Text color for the button
          }}
        />
        <Button type="text" style={{ color: token.colorTextSecondary }}>
          <BellOutlined />
        </Button>
        <Dropdown overlay={menu} trigger={['click']}>
          <Button type="text" style={{ color: token.colorTextSecondary}}>
            <UserOutlined />
          </Button>
        </Dropdown>
      </div>
    </Header>
  );
};

export default AppHeader;
