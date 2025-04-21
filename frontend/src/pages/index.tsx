import React, { useState, useEffect, useRef } from 'react';
import LibraryGrid from '../components/LibraryGrid';
import MyLibraryGrid from '../components/MyLibraryGrid';
import LoginModal from '../components/Modal/LoginModal';
import RegisterModal from '../components/Modal/RegisterModal';
import LibraryModal from '../components/Modal/LibraryModal';
import { useRouter } from 'next/router';
import { getCloudBackendUrl } from '../utils/common';
import { useRecoilState } from 'recoil';
import { userState } from '../state/userState';

const BE_Url_Cloud = getCloudBackendUrl();

const IndexPage: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useRecoilState(userState);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [showMyLibraryModal, setShowMyLibraryModal] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const libraryGridRef = useRef<any>(null);
  const myLibraryGridRef = useRef<any>(null);

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
  }, [setUser]);

  const refresh = () => {
    if (libraryGridRef.current) {
      libraryGridRef.current.fetchLibrary();
    }
    if (myLibraryGridRef.current) {
      myLibraryGridRef.current.fetchMyLibrary();
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
                  localStorage.removeItem('token');
                  setUser({
                    userId: null,
                    username: null,
                    token: null,
                    roles: [],
                    permissions: [],
                    isLoggedIn: false,
                  });
                  window.location.reload();
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
      <LibraryGrid 
        ref={libraryGridRef}
        onShowMore={() => setShowLibraryModal(true)}
      />

      {/* 我的曲目区域 */}
      {user.isLoggedIn && (
        <MyLibraryGrid 
          ref={myLibraryGridRef}
          onShowMore={() => setShowMyLibraryModal(true)}
          onUploadComplete={refresh}
          onDelete={refresh}
        />
      )}

      {/* 模态框 */}
      <LibraryModal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        title="乐谱库"
        type="library"
        onRefresh={refresh}
      />
      <LibraryModal
        isOpen={showMyLibraryModal}
        onClose={() => setShowMyLibraryModal(false)}
        title="我的乐谱"
        type="myLibrary"
        onRefresh={refresh}
      />
    </div>
  );
};

export default IndexPage;