import React from 'react';
import { Input } from 'antd';

const { Search } = Input;

const SearchBar = ({ searchQuery, setSearchQuery, handleSearch }) => {
  return (
    <Search
      placeholder="search your files"
      allowClear
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      onSearch={handleSearch}
      style={{ width: 300, backgroundColor: '#2a2a2a', borderColor: '#3a3a3a' }}
    />
  );
};

export default SearchBar;