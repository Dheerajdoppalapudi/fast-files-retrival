import React, { useEffect, useContext } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Layout } from "antd";
import Navbar from "./components/Navbar";
import FileManager from "./components/FileManager";
import UploadFile from "./components/UploadFile";
import FileComparison from "./components/FileComparision";
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import PendingApprovals from "./components/PendingApprovals";

const { Content } = Layout;

const AppContent = () => {
  const location = useLocation();
  const { user } = useContext(AuthContext);

  // Hide Navbar for login & register pages
  const hideNavbar = ["/login", "/register"].includes(location.pathname);

  return (
    <Layout className="app-layout">
      {!hideNavbar && user && <Navbar />}
      <Content className="app-content">
        <div className="app-container">
          <Routes>
            <Route path="/" element={<FileManager />} />
            <Route path="/upload" element={<UploadFile />} />
            <Route path="/compare" element={<FileComparison />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/approvals" element={<PendingApprovals userId={user?.id} />} />
          </Routes>
        </div>
      </Content>
    </Layout>
  );
};

function App() {


  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
