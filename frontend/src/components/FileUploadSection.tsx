import React, { useState } from 'react';
import { BE_Url_Cloud } from '../utils/common';

interface FileUploadSectionProps {
  onUploadComplete: () => void;
}

const FileUploadSection: React.FC<FileUploadSectionProps> = ({ onUploadComplete }) => {
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
      alert('请选择文件');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('is_public', isPublic.toString());

      const response = await fetch(`${BE_Url_Cloud}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        alert('上传成功');
        setFile(null);
        setIsPublic(true);
        // 清空input的值
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
        onUploadComplete();
      } else {
        alert('上传失败：' + (data.message || '未知错误'));
      }
    } catch (error) {
      console.error('上传错误:', error);
      alert('上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow w-full">
      <h3 className="text-lg font-bold mb-4">上传新乐谱</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <input
            type="file"
            accept=".xml,.musicxml"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isPublic"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
            设为公开
          </label>
        </div>
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className={`w-full px-4 py-2 rounded-md text-white font-medium
            ${isUploading 
              ? "bg-gray-400 cursor-not-allowed" 
              : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            }`}
        >
          {isUploading ? "上传中..." : "上传"}
        </button>
      </div>
    </div>
  );
};

export default FileUploadSection;