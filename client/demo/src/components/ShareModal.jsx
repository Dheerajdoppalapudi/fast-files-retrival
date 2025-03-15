import React, { useState, useEffect } from 'react';
import { Modal, Button, Select, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import api from '../utils/api';

const ShareModal = ({ visible, item, onClose }) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedUsers([]);
      fetchUsers();
    }
  }, [visible]);

  // Function to fetch users from backend
  const fetchUsers = async (searchQuery = '') => {
    setLoading(true);
    try {
      // Replace with your actual API endpoint
      const response = await api.accounts().serachUser({
        search: searchQuery
      })
      const data = response.data

 
      
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

  // Function to handle user search
  const handleUserSearch = (value) => {
    fetchUsers(value);
  };

  const onShare =async (item,email)=>{
    if(item&&item.id){
      if (item.isFolder){
        await api.Buckets().shareBucket({
          email:email,
          bucketId:item.id
        })

      }
      else{
        await api.Items().shareItem({
          email:email,
          itemID:item.id
        })
      }
    }

   


  }

  // Function to share file with selected users
  const handleShare = async () => {
    // if (selectedUsers.length === 0) {
    //   message.warning('Please select at least one user to share with');
    //   return;
    // }

    if (!selectedUsers){
      message.warning('Please select at least one user to share with');
      return
    }

    try {
      setLoading(true);
      // Use the onShare prop function to handle the actual API call
      await onShare(item, selectedUsers);
      message.success(`Successfully shared "${item.name}" with selected users`);
      onClose();
    } catch (error) {
      console.error('Error sharing file:', error);
      message.error('Failed to share the file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Share "${item?.name || ''}"`}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button 
          key="share" 
          type="primary" 
          onClick={handleShare} 
          loading={loading}
          disabled={selectedUsers.length === 0}
        >
          Share
        </Button>,
      ]}
      maskClosable={false}
      style={{ top: 20 }}
      width={500}
    >
      <div style={{ margin: '16px 0' }}>
        <p style={{ marginBottom: 8 }}>Select users to share with:</p>
        <Select
          // mode="multiple"
          placeholder="Search users"
          value={selectedUsers}
          onChange={setSelectedUsers}
          style={{ width: '100%' }}
          filterOption={false}
          onSearch={handleUserSearch}
          loading={loading}
          options={userOptions}
          optionLabelProp="label"
          optionFilterProp="label"
          showSearch
          notFoundContent={loading ? 'Loading...' : 'No users found'}
        />
      </div>
    </Modal>
  );
};

export default ShareModal;