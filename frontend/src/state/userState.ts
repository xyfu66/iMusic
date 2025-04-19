import { atom } from 'recoil';

export interface UserData {
  userId: string | null;
  username: string | null;
  token: string | null;
  roles: string[]; // 用户角色
  permissions: string[]; // 用户权限
  isLoggedIn: boolean; // 登录状态
}

export const userState = atom<UserData>({
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