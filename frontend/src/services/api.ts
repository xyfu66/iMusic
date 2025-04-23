import { BE_Url_Cloud } from '../utils/common';


export const api = {
  // 获取乐谱库
  fetchLibrary: async () => {
    try {
      const response = await fetch(`${BE_Url_Cloud}/library`);
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
      throw new Error(data.message || '获取乐谱库失败');
    } catch (error) {
      console.error('Error fetching library:', error);
      throw error;
    }
  },

  // 获取我的乐谱
  fetchMyLibrary: async () => {
    try {
      const response = await fetch(`${BE_Url_Cloud}/my-library`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
      throw new Error(data.message || '获取我的乐谱失败');
    } catch (error) {
      console.error('Error fetching my library:', error);
      throw error;
    }
  },

  // 删除乐谱
  deleteFile: async (file_id: string) => {
    try {
      const response = await fetch(`${BE_Url_Cloud}/delete/${file_id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        return true;
      }
      throw new Error(data.message || '删除乐谱失败');
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  },

  // 获取练习数据
  fetchPracticeData: async (file_id: string) => {
    try {
      const response = await fetch(`${BE_Url_Cloud}/practice/${file_id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
      throw new Error(data.message || '获取练习数据失败');
    } catch (error) {
      console.error('Error fetching practice data:', error);
      throw error;
    }
  },
}; 