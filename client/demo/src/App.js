import { ConfigProvider, theme } from 'antd';
import { useEffect, useState } from 'react';
import {  Routes, Route, Navigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { Login, Register } from './components/auth';

import HomePage from './HomePage';
import { useAuth } from './utils/auth';
import Applayout from './Layout/AppLayout';
import './App.css'

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation(); // Import useLocation from react-router-dom

  if (user) {
    // If we're coming from the login page, don't redirect
    if (location.pathname === '/login') {
      return null; // Let the login page handle navigation
    }
    // For other public routes, redirect to home
    return <Navigate to="/" replace />;
  }
  
  return children;
};

const PrivateRoute = ({ children }) => {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
    }
    return children;
};

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
);

useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    // Add global theme change handler
    window.__themeChange = (darkMode) => {
        setIsDarkMode(darkMode);
    };

    return () => {
        mediaQuery.removeEventListener('change', handleChange);
        delete window.__themeChange;
    };
}, []);

const themeConfig = {
    algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
        colorPrimary: '#1677ff',
        borderRadius: 8,
    },
};


  return (
    <ConfigProvider theme={themeConfig}>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route  element={<PrivateRoute><Applayout /></PrivateRoute>}>
          <Route path='/' index element={<HomePage />} />
      </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  );
};

export default App;