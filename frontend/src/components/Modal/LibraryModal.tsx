import React, { useState, useEffect } from 'react';
import { BE_Url_Cloud } from '../../utils/common';
import FileCard from '../FileCard';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'library' | 'myLibrary';
  onRefresh?: () => void;
}

const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  title,
  type,
  onRefresh
}) => {
  const [files, setFiles] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const pageSize = 10;

  useEffect(() => {
    if (isOpen) {
      fetchFiles(currentPage);
    }
  }, [isOpen, currentPage]);

  const fetchFiles = async (page: number) => {
    setIsLoading(true);
    try {
      const url = type === 'library' 
        ? `${BE_Url_Cloud}/library?page=${page}&page_size=${pageSize}`
        : `${BE_Url_Cloud}/my-library?page=${page}&page_size=${pageSize}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setFiles(data.data);
        setTotalPages(data.pagination.total_pages);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (onRefresh) {
      onRefresh();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            {type === 'library' ? '暂无乐谱，请上传文件。' : '您还没有上传任何乐谱。'}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {files.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    type={type}
                    onDelete={() => {
                      fetchFiles(currentPage);
                    }}
                  />
                ))}
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center mt-4 space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="px-4 py-2">
                  第 {currentPage} 页 / 共 {totalPages} 页
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LibraryModal; 