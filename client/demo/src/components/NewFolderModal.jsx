import React, { useState } from "react";
import { Modal, Input, Button } from "antd";
import api from "../utils/api";

const NewFolderModal = ({ visible, onCancel,onSuccess,breadcrumbPath }) => {
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(false); // State for loading indicator

  const handleCreate = async () => {

    setLoading(true);
    const lastFolder = breadcrumbPath.length > 0 ? breadcrumbPath[breadcrumbPath.length - 1] : null;
    const CreateBucket= await api.Buckets().CreateBucket({
      BucketName:folderName.trim(),
      parentId:lastFolder?lastFolder.id:null
    })
    setLoading(false);
    setFolderName("")
    onSuccess()
    onCancel()
 
  };

  return (
    <Modal
      title="Create New Folder"
      visible={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button
          key="create"
          type="primary"
          disabled={folderName.length===0}
          onClick={handleCreate}
          loading={loading} // Add loading state to the button
        >
          Create
        </Button>,
      ]}
    >
      <Input
        placeholder="Enter folder name"
        value={folderName}
        onChange={(e) => setFolderName(e.target.value.trimStart())}
      />
    </Modal>
  );
};

export default NewFolderModal;