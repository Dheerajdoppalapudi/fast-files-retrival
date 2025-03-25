import React, { useState, useEffect } from 'react';
import { Modal, Button, Select, message, Table, Tag, Divider, Typography, Tooltip, Space, Switch } from 'antd';
import { UserOutlined, DeleteOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import api from '../utils/api';

const { Title, Text } = Typography;

const ShareModal = ({ visible, item, onClose }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [userOptions, setUserOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState('view');
  const [accessList, setAccessList] = useState([]);
  const [fetchingAccessList, setFetchingAccessList] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible && item) {
      setSelectedUser(null);
      setSelectedPermission('view');
      fetchAccessList();
    }
  }, [visible, item]);

  // Function to fetch users from backend
  const fetchUsers = async (searchQuery = '') => {
    setLoading(true);
    try {
      const response = await api.accounts().serachUser({
        search: searchQuery
      });
      const data = response.data;
      
      // Format data for Select component
      const formattedOptions = data.map(user => ({
        value: user.email,
        label: (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {user.avatar ? (
              <img 
                src={user.avatar} 
                alt={user.username} 
                style={{ width: 24, height: 24, borderRadius: '50%', marginRight: 8 }}
              />
            ) : (
              <UserOutlined style={{ fontSize: 16, marginRight: 8 }} />
            )}
            <span>{user.username}</span>
            <span style={{ color: '#999', marginLeft: 8 }}>{user.email}</span>
          </div>
        ),
        name: user.username,
        email: user.email,
      }));
      
      setUserOptions(formattedOptions);
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch current access list
  const fetchAccessList = async () => {
    console.log(item)
    if (!item || !item.id) return;
    
    setFetchingAccessList(true);
    try {
      let response;
      if (item.isFolder) {
        response = await api.Buckets().getBucketShares({bucketId:item.id});
      } else {
        response = await api.Items().getItemShares({itemID:item.id});
      }
      console.log(response)
      
      setAccessList(response.data);
    } catch (error) {
      console.error('Error fetching access list:', error);
      message.error('Failed to load current shares');
    } finally {
      setFetchingAccessList(false);
    }
  };

  // Function to handle user search
  const handleUserSearch = (value) => {
    fetchUsers(value);
  };

  // Function to share item/bucket with selected user
  const handleShare = async () => {
    if (!selectedUser) {
      message.warning('Please select a user to share with');
      return;
    }

    if (!selectedPermission) {
      message.warning('Please select a permission level');
      return;
    }

    try {
      setLoading(true);
      
      if (item && item.id) {
        if (item.isFolder) {
          await api.Buckets().shareBucket({
            email: selectedUser,
            bucketId: item.id,
            permissionType: selectedPermission
          });
        } else {
          await api.Items().shareItem({
            email: selectedUser,
            itemID: item.id,
            permissionType: selectedPermission
          });
        }
      }
      
      message.success(`Successfully shared "${item.name}" with user`);
      // Refresh access list
      fetchAccessList();
      // Reset selection
      setSelectedUser(null);
    } catch (error) {
      console.error('Error sharing item:', error);
      message.error('Failed to share the item');
    } finally {
      setLoading(false);
    }
  };

  // Function to remove user access
  const handleRemoveAccess = async (record) => {
    try {
      setLoading(true);
      if (item.isFolder) {
        await api.Buckets().removeBucketShare({
          email: record.email,
          bucketId: item.id
        });
      } else {
        await api.Items().removeItemShare({
          email: record.email,
          itemID: item.id
        });
      }
      
      message.success(`Access removed for ${record.username || record.email}`);
      fetchAccessList();
    } catch (error) {
      console.error('Error removing access:', error);
      message.error('Failed to remove access');
    } finally {
      setLoading(false);
    }
  };

  // Function to update user permission
  const handleUpdatePermission = async (record, newPermission) => {
    try {
      setLoading(true);
      if (item.isFolder) {
        await api.Buckets().shareBucket({
          email: record.email,
          bucketId: item.id,
          permissionType: newPermission
        });
      } else {
        await api.Items().shareItem({
          email: record.email,
          itemID: item.id,
          permissionType: newPermission
        });
      }
      
      message.success(`Permission updated for ${record.username || record.email}`);
      fetchAccessList();
    } catch (error) {
      console.error('Error updating permission:', error);
      message.error('Failed to update permission');
    } finally {
      setLoading(false);
    }
  };

  // Function to update inheritance setting
const handleUpdateInheritance = async (record) => {
  try {
    setLoading(true);
    if (item.isFolder) {
      // await api.Buckets().updateShareInheritance({
      //   email: record.email,
      //   bucketId: item.id,
      //   inherit: record.inherited
      // });
    }
    
    message.success(`Inheritance setting updated for ${record.username || record.email}`);
    // fetchAccessList();
  } catch (error) {
    console.error('Error updating inheritance:', error);
    message.error('Failed to update inheritance setting');
  } finally {
    setLoading(false);
  }
};



  const columns = [
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
      render: (_, record) => (
        <Space>
          {record.avatar ? (
            <img 
              src={record.avatar} 
              alt={record.username} 
              style={{ width: 32, height: 32, borderRadius: '50%' }}
            />
          ) : (
            <UserOutlined style={{ fontSize: 20, padding: 6, backgroundColor: '#f0f0f0', borderRadius: '50%' }} />
          )}
          <div>
            <Text strong>{record.username || 'User'}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Permission',
      dataIndex: 'permissionType',
      key: 'permissionType',
      render: (permission, record) => {
        const color = permission === 'view' ? 'blue' : 'green';
        const icon = permission === 'view' ? <EyeOutlined /> : <EditOutlined />;
        return (
          <Select
            value={permission}
            style={{ width: 120 }}
            onChange={(value) => handleUpdatePermission(record, value)}
            disabled={loading}
          >
            <Select.Option value="view">
              <Tag color="blue" icon={<EyeOutlined />}>View</Tag>
            </Select.Option>
            <Select.Option value="write">
              <Tag color="green" icon={<EditOutlined />}>Edit</Tag>
            </Select.Option>
          </Select>
        );
      },
    },
    {
      title: 'Inherited',
      key: 'inherited',
      render: (_, record) => {
        // Check if this is a folder (only folders can have inheritance)
        const isFolder = item?.isFolder;
        
        return isFolder ? (
          <Switch
            checked={record.inherited || false}
            onChange={(checked) => {
              // Handle the inheritance toggle
              const updatedRecord = { ...record, inherited: checked };
              handleUpdateInheritance(updatedRecord);
            }}
            checkedChildren="Yes"
            unCheckedChildren="No"
            disabled={loading}
          />
        ) : (
          <Tag color="gray">N/A</Tag>
        );
      },
    },
    
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Tooltip title="Remove access">
          <Button 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => handleRemoveAccess(record)}
            size="small"
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span>Share "{item?.name || ''}"</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Close
        </Button>
      ]}
      maskClosable={false}
      style={{ top: 20 }}
      width={600}
    >
      <div style={{ margin: '16px 0' }}>
        <Title level={5}>Add new user</Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Select
            placeholder="Search users"
            value={selectedUser}
            onChange={setSelectedUser}
            style={{ flex: 1 }}
            filterOption={false}
            onSearch={handleUserSearch}
            loading={loading}
            options={userOptions}
            optionLabelProp="label"
            optionFilterProp="label"
            showSearch
            notFoundContent={loading ? 'Loading...' : 'No users found'}
          />
          <Select
            placeholder="Permission"
            value={selectedPermission}
            onChange={setSelectedPermission}
            style={{ width: 120 }}
          >
          <Select.Option value="view">
              <Tag color="blue" icon={<EyeOutlined />}>View</Tag>
            </Select.Option>
            <Select.Option value="write">
              <Tag color="green" icon={<EditOutlined />}>Edit</Tag>
            </Select.Option>
          </Select>
          <Button 
            type="primary" 
            onClick={handleShare} 
            loading={loading}
            disabled={!selectedUser}
          >
            Share
          </Button>
        </div>
      </div>

      <Divider />

      <div style={{ marginTop: 16 }}>
        <Title level={5}>Users with access</Title>
        <Table
          columns={columns}
          dataSource={accessList}
          rowKey="email"
          pagination={false}
          loading={fetchingAccessList}
          size="small"
          locale={{ emptyText: 'No users have access yet' }}
          style={{ marginTop: 8 }}
        />
      </div>
    </Modal>
  );
};

export default ShareModal;