import React, { useState, useContext } from "react";
import { Form, Input, Button, message, Card } from "antd";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext"; // Import AuthContext

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useContext(AuthContext); 

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
  
      const data = await response.json();
      if (response.ok) {
        login(data.token, data.id, data.username, data.role); // ✅ Store all user details
        message.success(`Welcome, ${data.username}!`);
        navigate("/");
      } else {
        message.error(data.message || "Login failed");
      }
    } catch (error) {
      message.error("Something went wrong!");
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <Card title="Login" bordered={false} style={{ width: 400 }}>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item label="Username" name="username" rules={[{ required: true, message: "Enter your username" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Password" name="password" rules={[{ required: true, message: "Enter your password" }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Login
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
