import React, { useState, useEffect } from 'react';
import { Modal, Button, Select, message, Table, Tag, Divider, Typography, Tooltip, Space, Switch } from 'antd';
import { UserOutlined, DeleteOutlined, CheckCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import api from '../utils/api';

const { Title, Text } = Typography;

const ApprovalModal = ({ visible, item, onClose }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [userOptions, setUserOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approversList, setApproversList] = useState([]);
  const [fetchingApprovers, setFetchingApprovers] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [ownerAutoApproves, setOwnerAutoApproves] = useState(false);
  const [versioningEnabled, setVersioningEnabled] = useState(false);
  const [settings, setSettings] = useState(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible && item) {
      setSelectedUser(null);
      fetchApprovalSettings();
    }
  }, [visible, item]);

  // Function to fetch approval settings and approvers
  const fetchApprovalSettings = async () => {
    if (!item || !item.id) return;
    
    setFetchingApprovers(true);
    try {
      // Single endpoint for both items and buckets based on type
      let response;
      if (item.isFolder) {
        response = await api.Approvals().getBucketSetting({ bucketId: item.id });
      } else {
        response = await api.Approvals().getItemSetting({ itemID: item.id });
      }
      
      // Update settings and approvers from response
      if (response.data) {
        // Update settings
        const responseSettings = response.data.settings;
        setSettings(responseSettings);
        setRequiresApproval(responseSettings?.requiresApproval || false);
        setOwnerAutoApproves(responseSettings?.ownerAutoApproves || false);
        
        // Set versioningEnabled only for items
        if (!item.isFolder && responseSettings?.versioningEnabled !== undefined) {
          setVersioningEnabled(responseSettings.versioningEnabled);
        }
        
        // Update approvers list
        setApproversList(response.data.approvers[0].users || []);
      }
    } catch (error) {
      console.error('Error fetching approval settings:', error);
      message.error('Failed to load approval settings');
    } finally {
      setFetchingApprovers(false);
    }
  };

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

  // Function to handle user search
  const handleUserSearch = (value) => {
    fetchUsers(value);
  };

  // Function to perform approval action
  const performApprovalAction = async (action, data = {}) => {
    if (!item || !item.id) return;
    
    try {
      setLoading(true);
      
      // Prepare the payload with action and additional data
      const payload = {
        action,
        ...data
      };

      if (item.isFolder) {
         await api.Approvals().UpdateBucketSetting({ bucketId: item.id ,body:payload});
      } else {
         await api.Approvals().UpdateItemSetting({ itemID: item.id ,body:payload});
      }
      
      return true;
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      message.error(`Failed to ${action.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Function to add approver
  const handleAddApprover = async () => {
    if (!selectedUser) {
      message.warning('Please select a user to add as approver');
      return;
    }

    const success = await performApprovalAction('addApprover', { email: selectedUser });
    
    if (success) {
      message.success(`Successfully added approver for "${item.name}"`);
      // Refresh approvers list
      fetchApprovalSettings();
      // Reset selection
      setSelectedUser(null);
    }
  };

  // Function to remove approver
  const handleRemoveApprover = async (record) => {
    const success = await performApprovalAction('removeApprover', { email: record.email });
    
    if (success) {
      message.success(`Approver removed: ${record.username || record.email}`);
      fetchApprovalSettings();
    }
  };

  // Function to toggle approval requirement
  const handleToggleApprovalRequirement = async (checked) => {
    // Temporarily update UI state
    setRequiresApproval(checked);
    
    const success = await performApprovalAction('updateSettings', { 
      requiresApproval: checked,
      ownerAutoApproves: ownerAutoApproves,
      ...(item.isFolder ? {} : { versioningEnabled: versioningEnabled }) // Only include for items
    });
    
    if (success) {
      message.success(`Approval requirement ${checked ? 'enabled' : 'disabled'} for "${item.name}"`);
    } else {
      // Revert UI if failed
      setRequiresApproval(!checked);
    }
  };

  // Function to toggle owner auto-approval
  const handleToggleOwnerAutoApproval = async (checked) => {
    // Temporarily update UI state
    setOwnerAutoApproves(checked);
    
    const success = await performApprovalAction('updateSettings', { 
      requiresApproval: requiresApproval,
      ownerAutoApproves: checked,
      ...(item.isFolder ? {} : { versioningEnabled: versioningEnabled }) // Only include for items
    });
    
    if (success) {
      message.success(`Owner auto-approval ${checked ? 'enabled' : 'disabled'} for "${item.name}"`);
    } else {
      // Revert UI if failed
      setOwnerAutoApproves(!checked);
    }
  };

  // Function to toggle versioning (only for items)
  const handleToggleVersioning = async (checked) => {
    if (item.isFolder) return; // Only applicable for items
    
    // Temporarily update UI state
    setVersioningEnabled(checked);
    
    const success = await performApprovalAction('updateSettings', { 
      requiresApproval: requiresApproval,
      ownerAutoApproves: ownerAutoApproves,
      versioningEnabled: checked
    });
    
    if (success) {
      message.success(`Versioning ${checked ? 'enabled' : 'disabled'} for "${item.name}"`);
    } else {
      // Revert UI if failed
      setVersioningEnabled(!checked);
    }
  };

  // Function to set default approver
  const handleSetDefaultApprover = async (record) => {
    const success = await performApprovalAction('setDefaultApprover', { email: record.email });
    
    if (success) {
      message.success(`Default approver set to ${record.username || record.email}`);
      fetchApprovalSettings();
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
          {record.isDefault && (
            <Tag color="gold">Default</Tag>
          )}
          {record.isGroup && (
            <Tag color="blue">Group</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {!record.isDefault && (
            <Tooltip title="Set as default approver">
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleSetDefaultApprover(record)}
                size="small"
                ghost
                disabled={!settings?.canManageApprovers}
              />
            </Tooltip>
          )}
          <Tooltip title="Remove approver">
            <Button 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => handleRemoveApprover(record)}
              size="small"
              disabled={!settings?.canManageApprovers}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Determine if the user can manage approvers
  const canManageApprovers = settings?.canManageApprovers || false;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span>
            {item?.isFolder ? 'Bucket' : 'File'} Settings: "{item?.name || ''}"
          </span>
          {item && !item.isFolder && settings?.approvalStatus && (
            <Tag 
              color={settings.approvalStatus === 'approved' ? 'green' : 
                    settings.approvalStatus === 'rejected' ? 'red' : 'orange'}
              style={{ marginLeft: 8 }}
            >
              {settings.approvalStatus.charAt(0).toUpperCase() + settings.approvalStatus.slice(1)}
            </Tag>
          )}
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
      {fetchingApprovers ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>Loading settings...</div>
      ) : (
        <>
          <div style={{ margin: '16px 0' }}>
            <Title level={5}>General Settings</Title>
            <div style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>Require Approval</Text>
                  <Switch
                    checked={requiresApproval}
                    onChange={handleToggleApprovalRequirement}
                    loading={loading}
                    disabled={!canManageApprovers}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>Owner Auto-Approves</Text>
                  <Switch
                    checked={ownerAutoApproves}
                    onChange={handleToggleOwnerAutoApproval}
                    loading={loading}
                    disabled={!requiresApproval || !canManageApprovers}
                  />
                </div>
                
                {/* Only show versioning toggle for items */}
                {!item?.isFolder && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text>Version Control</Text>
                      <Tooltip title="Enable to track changes and keep history of file versions">
                        <Text type="secondary" style={{ marginLeft: 4 }}>ⓘ</Text>
                      </Tooltip>
                    </div>
                    <Switch
                      checked={versioningEnabled}
                      onChange={handleToggleVersioning}
                      loading={loading}
                      disabled={!canManageApprovers}
                      icon={<HistoryOutlined />}
                    />
                  </div>
                )}
              </Space>
            </div>
          </div>

          <Divider />

          <div style={{ margin: '16px 0' }}>
            <Title level={5}>Add New Approver</Title>
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
                disabled={!requiresApproval || !canManageApprovers}
              />
              <Button 
                type="primary" 
                onClick={handleAddApprover} 
                loading={loading}
                disabled={!selectedUser || !requiresApproval || !canManageApprovers}
              >
                Add Approver
              </Button>
            </div>
          </div>

          <Divider />

          <div style={{ marginTop: 16 }}>
            <Title level={5}>Current Approvers</Title>
            {settings?.defaultApprover && (
              <div style={{ marginBottom: 16 }}>
                <Text>Default Approver: </Text>
                <Text strong>{settings.defaultApprover.name}</Text>
              </div>
            )}
            {item?.isFolder && settings?.itemsCount !== undefined && (
              <div style={{ marginBottom: 16 }}>
                <Text>Items in Bucket: </Text>
                <Text strong>{settings.itemsCount}</Text>
              </div>
            )}
            {!item?.isFolder && settings?.bucketName && (
              <div style={{ marginBottom: 16 }}>
                <Text>Parent Bucket: </Text>
                <Text strong>{settings.bucketName}</Text>
              </div>
            )}
            <Table
              columns={columns}
              dataSource={approversList}
              rowKey="email"
              pagination={false}
              loading={fetchingApprovers}
              size="small"
              locale={{ emptyText: 'No approvers configured' }}
              style={{ marginTop: 8 }}
            />
          </div>
        </>
      )}
    </Modal>
  );
};

export default ApprovalModal;