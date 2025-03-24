import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, theme, Badge, List, Button } from 'antd';
import { 
    UserOutlined, 
    HomeOutlined, 
    AppstoreOutlined, 
    LogoutOutlined,
    BellOutlined ,
    BulbOutlined, BulbFilled 
} from '@ant-design/icons';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../utils/auth';
import api from '../utils/api';
import AppHeader from '../components/Header'

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { useToken } = theme;

const AppLayout = () => {
    const { logout, user } = useAuth();
    const location = useLocation();
    const { token } = useToken();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    // const notificationService = api.notifications();
    const [isDarkMode, setIsDarkMode] = useState(
      window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const toggleTheme = () => {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      window.__themeChange?.(newMode); // This will be defined in App.js
  };




    return (
        <Layout style={{ minHeight: "100vh", backgroundColor: "#1a1a1a" }}>
        <AppHeader toggleTheme={toggleTheme} isDarkMode={isDarkMode} />
            <Content>
                  <Outlet />
                  
              </Content>
      
      </Layout>
    );
};

export default AppLayout;