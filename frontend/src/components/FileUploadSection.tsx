import React, { useState } from 'react';

interface FileUploadSectionProps {
  backendUrl: string;
  onUploadComplete: () => void;
}

const FileUploadSection: React.FC<FileUploadSectionProps> = ({ backendUrl, onUploadComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file to upload.");
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("is_public", String(isPublic));

    try {
      const response = await fetch(`${backendUrl}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`, // 添加 Authorization 头
        },
        body: formData,
      });

      const data = await response.json();
      if (!data.success) {
        alert(data.message);
      }

      alert("File uploaded successfully!");
      setFile(null);
      setIsPublic(false);
      onUploadComplete(); // 刷新曲目库
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow">
      <h3 className="text-lg font-bold mb-2">Upload a New File</h3>
      <input
        type="file"
        accept=".xml,.musicxml" // 限制文件类型
        onChange={handleFileChange}
        className="mb-2"
      />
      <div className="flex items-center mb-2">
        <input
          type="checkbox"
          id="isPublic"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="isPublic">Make this file public</label>
      </div>
      <button
        onClick={handleUpload}
        disabled={isUploading}
        className={`px-4 py-2 rounded text-white ${isUploading ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"}`}
      >
        {isUploading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
};

export default FileUploadSection;