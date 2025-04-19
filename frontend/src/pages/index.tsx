import React, { useState, useRef, useEffect } from 'react';
import LibraryGrid from '../components/LibraryGrid';
import MyLibraryGrid from '../components/MyLibraryGrid';
import FileUploadSection from '../components/FileUploadSection';
import LoginModal from '../components/LoginModal';
import RegisterModal from '../components/RegisterModal';
import { useRouter } from 'next/router'; // 引入路由
import { getCloudBackendUrl } from '../utils/common';
import { useRecoilState } from 'recoil';
import { practiceState } from '../state/practiceState';
import { userState } from '../state/userState';

const BE_Url_Cloud = getCloudBackendUrl();

const IndexPage: React.FC = () => {
  const router = useRouter(); // 初始化路由
  const [practiceData, setPracticeData] = useRecoilState(practiceState);
  const [user, setUser] = useRecoilState(userState);

  const [library, setLibrary] = useState<any[]>([]);
  const [myLibrary, setMyLibrary] = useState<any[]>([]);

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await fetch(`${BE_Url_Cloud}/auth/validate-token`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (data.success) {
          setUser({
            userId: data.data.userId,
            username: data.data.username,
            token,
            roles: data.data.roles,
            permissions: data.data.permissions,
            isLoggedIn: true,
          });
        } else {
          localStorage.removeItem('token');
          setUser({
            userId: null,
            username: null,
            token: null,
            roles: [],
            permissions: [],
            isLoggedIn: false,
          });
        }
      } catch (error) {
        console.error('Error validating token:', error);
      }
    };

    checkLoginStatus();
    fetchLibrary();

  }, [setUser]);

  useEffect(() => {
    if (user.isLoggedIn) {
      fetchMyLibrary();
    }
  }, [user.isLoggedIn]);

  const fetchLibrary = async () => {
    try {
      const response = await fetch(`${BE_Url_Cloud}/library`);
      const data = await response.json();
      if (data.success) {
        setLibrary(data.data);
      }
    } catch (error) {
      console.error('Error fetching library:', error);
    }
  };

  const fetchMyLibrary = async () => {
    try {
      const response = await fetch(`${BE_Url_Cloud}/my-library`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`, // 如果需要身份验证
        },
      });
      const data = await response.json();
      if (data.success) {
        setMyLibrary(data.data);
      } else {
        console.error('Error fetching my library:', data.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Error fetching my library:', error);
    }
  };
  
  const refreshLibrary = async () => {
    try {
      await fetchLibrary();
      await fetchMyLibrary(); // 刷新我的曲目库
    } catch (error) {
      console.error("Error refreshing library:", error);
    }
  };

  const handleSelectLibraryFile = async (file_id: string) => {
    try {
      const response = await fetch(`${BE_Url_Cloud}/practice/${file_id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
  
      if (data.success) {
        setPracticeData({
          useUrl: data.data.use_url ? 'true' : 'false',
          fileInfo: data.data.file_info,
          fileContent: data.data.file_content,
          midiContent: data.data.midi_content,
          audioContent: data.data.audio_content,
          fileUrl: data.data.file_url,
          midiUrl: data.data.midi_url,
          audioUrl: data.data.audio_url,
        });
        router.push('/PracticePage');
      } else {
        alert('Failed to fetch practice data');
      }
    } catch (error) {
      console.error('Error fetching practice data:', error);
    }
  };

  const handleDelete = async (file_id: string) => {
    try {
      const response = await fetch(`${BE_Url_Cloud}/delete/${file_id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        alert('File deleted successfully');
        refreshLibrary();
      } else {
        alert('Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex justify-between items-center p-4 bg-gray-800 text-white">
        <h1 className="text-xl font-bold">Score Following App</h1>
        <div>
          {!user.isLoggedIn ? (
            <>
              <button
                onClick={() => setIsRegisterOpen(true)}
                className="mr-4 bg-blue-500 text-white px-4 py-2 rounded"
              >
                Register
              </button>
              <button
                onClick={() => setIsLoginOpen(true)}
                className="bg-green-500 text-white px-4 py-2 rounded"
              >
                Login
              </button>
            </>
          ) : (
            <div className="flex items-center space-x-4">
              <span>Welcome, {user.username}</span>
              <button
                onClick={() => {
                  localStorage.removeItem('token'); // 清除本地存储
                  setUser({
                    userId: null,
                    username: null,
                    token: null,
                    roles: [],
                    permissions: [],
                    isLoggedIn: false,
                  }); // 设置为未登录状态
                  window.location.reload(); // 刷新页面
                }}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
      />

      {/* 调音器 & 节拍器入口 */}
      <div className="flex justify-center space-x-4 py-4 bg-gray-100">
        <button
          onClick={() => router.push('/TunerMetronome?tab=Tuner')}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
        >
          🎵 调音器
        </button>
        <button
          onClick={() => router.push('/TunerMetronome?tab=Metronome')}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
        >
          ⏱️ 节拍器
        </button>
      </div>

      {/* 曲目库区域 */}
      <div className="flex-1 bg-gray-100">
        <h2 className="text-center text-2xl font-bold py-4">Library</h2>
        <LibraryGrid library={library} onSelect={handleSelectLibraryFile} onDelete={handleDelete} />
      </div>

      {/* 我的曲目区域 */}
      {user.isLoggedIn && (
        <div className="flex-1 bg-gray-50">
          <h2 className="text-center text-2xl font-bold py-4">My Library</h2>
          <MyLibraryGrid myLibrary={myLibrary} onSelect={handleSelectLibraryFile} onDelete={handleDelete} />

          {/* 文件上传入口 */}
          <div className="mt-4">
            <FileUploadSection backendUrl={BE_Url_Cloud} onUploadComplete={refreshLibrary} />
          </div>
        </div>
      )}
    </div>
  );
};

export default IndexPage;