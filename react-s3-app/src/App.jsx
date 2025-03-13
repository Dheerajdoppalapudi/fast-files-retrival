import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "antd";
import Navbar from "./components/Navbar";
import FileManager from "./components/FileManager";
import UploadFile from "./components/UploadFile";
import FileComparison from "./components/FileComparision";
import testS3Connection from "./Tests3";

const { Content } = Layout;

function App() {
  useEffect(() => {
    testS3Connection();
  }, []);

  return (
    <Router>
      <Layout className="app-layout">
        <Navbar />
        <Content className="app-content">
          <div className="app-container">
            <Routes>
              <Route path="/" element={<FileManager />} />
              <Route path="/upload" element={<UploadFile />} />
              <Route path="/compare" element={<FileComparison />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Router>
  );
}

export default App;
