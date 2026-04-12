import axios from 'axios';
import { API_BASE_URL } from './api';

const getToken = () => localStorage.getItem('accessToken');

export const ProfileApi = {
getMyProfile(userId: string) {
  const abortController = new AbortController();
  
  const request = axios.get(`${API_BASE_URL}/user/${userId}`, {
    signal: abortController.signal,
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  return { request, abort: () => abortController.abort() };
},
async updateMyProfile(userId: string, data: object) {
    const response = await axios.put(`${API_BASE_URL}/user/${userId}`, data, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    return response.data;
  },
  uploadAvatar(file: File) {
  const formData = new FormData();
  formData.append('image', file); 

  const request = axios.post(`${API_BASE_URL}/upload`, formData, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  return { request };
},

};