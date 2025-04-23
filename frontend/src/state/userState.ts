import { atom, useRecoilState } from 'recoil';
import { useEffect } from 'react';

export interface UserData {
  userId: string | null;
  username: string | null;
  token: string | null;
  roles: string[]; // 用户角色
  permissions: string[]; // 用户权限
  isLoggedIn: boolean; // 登录状态
}

const userStateAtom = atom<UserData>({
  key: 'userState',
  default: {
    userId: null,
    username: null,
    token: null,
    roles: [],
    permissions: [],
    isLoggedIn: false,
  },
});

export const useUserState = () => {
  const [userState, setUserState] = useRecoilState(userStateAtom);
  
  useEffect(() => {
    // 从 localStorage 恢复状态
    const savedState = localStorage.getItem('userState');
    if (savedState) {
      setUserState(JSON.parse(savedState));
    }
  }, []);

  return [userState, setUserState] as const;
};