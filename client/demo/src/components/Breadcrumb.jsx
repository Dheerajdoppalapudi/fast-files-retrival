import React from 'react';
import { Breadcrumb, Typography, theme } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
const { useToken } = theme;

const { Title } = Typography;

const BreadcrumbComponent = ({ currentView, searchQuery, breadcrumbPath, navigateToBreadcrumb, currentCategory }) => {
  const { token } = useToken(); // Get current theme token

  // Define text colors based on the theme mode (light or dark)
  const breadcrumbStyle = {
    cursor: 'pointer',
    transition: 'color 0.3s ease',
  };

  const breadcrumbActiveStyle = {
    fontWeight: 500,
  };

  const breadcrumbHoverStyle = {
    textDecoration: 'underline',
  };

  const breadcrumbColor = token.colorTextBase; // Text color for light/dark mode
  const breadcrumbHoverColor = token.colorPrimary; // Hover color from theme
  const breadcrumbSearchColor = '#e6e6e6'; // Static search query color (for search view)

  // Handle search view
  if (currentView === 'search') {
    return (
      <Breadcrumb separator="/" style={{ color: breadcrumbColor }}>
        <Breadcrumb.Item>
          <span
            style={{
              ...breadcrumbStyle,
              color: breadcrumbColor,
            }}
            onClick={() => navigateToBreadcrumb(-1)}
            onMouseEnter={(e) => (e.target.style.color = breadcrumbHoverColor)}
            onMouseLeave={(e) => (e.target.style.color = breadcrumbColor)}
          >
            <HomeOutlined /> {currentCategory.title}
          </span>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <span
            style={{
              ...breadcrumbStyle,
              color: breadcrumbSearchColor,
            }}
          >
            Search: {searchQuery}
          </span>
        </Breadcrumb.Item>
      </Breadcrumb>
    );
  }

  // Handle breadcrumb path view
  else if (breadcrumbPath.length > 0) {
    return (
      <Breadcrumb separator="/" style={{ color: breadcrumbColor }}>
        <Breadcrumb.Item>
          <span
            style={{
              ...breadcrumbStyle,
              color: breadcrumbColor,
            }}
            onClick={() => navigateToBreadcrumb(-1)}
            onMouseEnter={(e) => (e.target.style.color = breadcrumbHoverColor)}
            onMouseLeave={(e) => (e.target.style.color = breadcrumbColor)}
          >
            <HomeOutlined /> {currentCategory.title}
          </span>
        </Breadcrumb.Item>

        {breadcrumbPath.map((item, index) => (
          <Breadcrumb.Item key={item.id}>
            <span
              style={{
                ...breadcrumbStyle,
                color:
                  index === breadcrumbPath.length - 1
                    ? breadcrumbActiveStyle
                    : breadcrumbColor,
                ...(index === breadcrumbPath.length - 1 ? breadcrumbActiveStyle : {}),
              }}
              onClick={() => navigateToBreadcrumb(index)}
              onMouseEnter={(e) => (e.target.style.color = breadcrumbHoverColor)}
              onMouseLeave={(e) =>
                (e.target.style.color =
                  index === breadcrumbPath.length - 1 ? breadcrumbActiveStyle : breadcrumbColor)
              }
            >
              {item.name}
            </span>
          </Breadcrumb.Item>
        ))}
      </Breadcrumb>
    );
  }

  // Default case for breadcrumb
  else {
    return (
      <Title level={4} style={{ color: breadcrumbColor, margin: 0 }}>
        <HomeOutlined /> {currentCategory.title}
      </Title>
    );
  }
};

export default BreadcrumbComponent;
