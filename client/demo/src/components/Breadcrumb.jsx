import React from 'react';
import { Breadcrumb, Typography } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

const { Title } = Typography;

const BreadcrumbComponent = ({ currentView, searchQuery, breadcrumbPath, navigateToBreadcrumb }) => {
  if (currentView === 'search') {
    return (
      <Breadcrumb 
        separator="/" 
        style={{ color: '#e6e6e6' }}
        items={[
          {
            title: <span style={{ color: '#e6e6e6', cursor: 'pointer' }} onClick={() => navigateToBreadcrumb(-1)}>
              <HomeOutlined /> All files
            </span>,
          },
          {
            title: <span style={{ color: '#e6e6e6' }}>Search: {searchQuery}</span>,
          }
        ]}
      />
    );
  } else if (breadcrumbPath.length > 0) {
    return (
      <Breadcrumb 
        separator="/" 
        style={{ color: '#e6e6e6' }}
      >
        <Breadcrumb.Item>
          <span 
            style={{ color: '#e6e6e6', cursor: 'pointer' }} 
            onClick={() => navigateToBreadcrumb(-1)}
          >
            <HomeOutlined /> All files
          </span>
        </Breadcrumb.Item>
        
        {breadcrumbPath.map((item, index) => (
          <Breadcrumb.Item key={item.id}>
            <span 
              style={{ 
                color: index === breadcrumbPath.length - 1 ? 'white' : '#e6e6e6', 
                cursor: 'pointer',
                fontWeight: index === breadcrumbPath.length - 1 ? '500' : 'normal'
              }} 
              onClick={() => navigateToBreadcrumb(index)}
            >
              {item.name}
            </span>
          </Breadcrumb.Item>
        ))}
      </Breadcrumb>
    );
  } else {
    return (
      <Title level={4} style={{ color: 'white', margin: 0 }}>
        <HomeOutlined /> All files
      </Title>
    );
  }
};

export default BreadcrumbComponent;