import { BE_Url_Cloud } from '../utils/common'; // 导入共通方法


export const login = async (email: string, password: string) => {
  const response = await fetch(`${BE_Url_Cloud}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
};

export const register = async (email: string, password: string, username: string) => {
  const response = await fetch(`${BE_Url_Cloud}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username }),
  });
  return response.json();
};