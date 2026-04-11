import axios from 'axios';
import { API_BASE_URL } from './api';

const getToken = () => localStorage.getItem('accessToken');

export const FridgeApi = {

  getMyFridge() {
    const abortController = new AbortController();
    const request = axios.get(`${API_BASE_URL}/fridges/me`, {
      signal: abortController.signal,
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    return { request, abort: () => abortController.abort() };
  },

  getMembers() {
    const request = axios.get(`${API_BASE_URL}/fridges/me/members`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    return { request };
  },

  async createFridge(name: string) {
    const response = await axios.post(`${API_BASE_URL}/fridges`, {name}, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    return response.data;
  },

  async joinFridge(inviteCode: string) {
    const response = await axios.post(`${API_BASE_URL}/fridges/join`, {inviteCode}, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    return response.data;
  },

  async leaveFridge() {
    const response = await axios.post(`${API_BASE_URL}/fridges/leave`, {}, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    return response.data;
  },

};