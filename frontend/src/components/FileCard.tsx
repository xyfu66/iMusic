import React from 'react';
import { api } from '../services/api';
import { useRouter } from 'next/router';
import { useRecoilState } from 'recoil';
import { practiceState } from '../state/practiceState';

interface FileCardProps {
  file: {
    id: string;
    filename: string;
    created_at?: string;
    uploaded_at?: string;
    username?: string;
    is_public?: boolean;
  };
  type: 'library' | 'myLibrary';
  onDelete?: () => void;
}

const FileCard: React.FC<FileCardProps> = ({ file, type, onDelete }) => {
  const router = useRouter();
  const [practiceData, setPracticeData] = useRecoilState(practiceState);

  const handleSelect = async () => {
    try {
      const data = await api.fetchPracticeData(file.id);
      setPracticeData({
        useUrl: data.use_url ? 'true' : 'false',
        fileInfo: data.file_info,
        fileContent: data.file_content,
        midiContent: data.midi_content,
        audioContent: data.audio_content,
        fileUrl: data.file_url,
        midiUrl: data.midi_url,
        audioUrl: data.audio_url,
      });
      router.push('/PracticePage');
    } catch (error) {
      alert('获取练习数据失败');
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个乐谱吗？')) {
      try {
        await api.deleteFile(file.id);
        if (onDelete) {
          onDelete();
        }
        alert('删除成功');
      } catch (error) {
        alert('删除失败');
      }
    }
  };

  return (
    <div
      className="group relative bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden file-card"
    >
      <div 
        className="p-4 cursor-pointer"
        onClick={handleSelect}
      >
        <h3 className="font-bold text-lg mb-2 truncate">{file.filename}</h3>
        {(file.created_at || file.uploaded_at) && (
          <p className="text-xs text-gray-500 mb-1">
            上传时间: {new Date(file.created_at || file.uploaded_at || '').toLocaleString()}
          </p>
        )}
        {type === 'library' && file.username && (
          <p className="text-sm text-gray-600">
            上传者: {file.username}
          </p>
        )}
        {type === 'myLibrary' && (
          <p className="text-sm text-gray-600">
            状态: {file.is_public ? '公开' : '私有'}
          </p>
        )}
      </div>
      {type === 'myLibrary' && (
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 p-2 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default FileCard;