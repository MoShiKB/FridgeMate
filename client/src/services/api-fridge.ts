import axios from 'axios';
import { API_BASE_URL } from './api';

const getToken = () => localStorage.getItem('accessToken');

export interface FridgeMemberDetail {
  userId: string;
  displayName: string;
  profileImage?: string;
}

export interface FridgeDto {
  _id?: string;
  id?: string;
  name: string;
  inviteCode: string;
  ownerUserId?: string;
  members?: FridgeMemberDetail[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiResponse<T> {
  ok: boolean;
  data: T;
}

export const FridgeApi = {
  getMyFridge() {
    return axios.get<ApiResponse<FridgeDto>>(`${API_BASE_URL}/fridges/me`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
  },

  getMyFridgeMembers() {
    return axios.get<PaginatedResponse<FridgeMemberDetail>>(
      `${API_BASE_URL}/fridges/me/members`,
      {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      }
    );
  },
};
