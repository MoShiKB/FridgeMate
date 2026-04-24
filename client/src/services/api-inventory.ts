import axios from 'axios';
import { API_BASE_URL } from './api';
import { PaginatedResponse } from './api-fridge';

const getToken = () => localStorage.getItem('accessToken');

export interface InventoryItemDto {
  id?: string;
  _id?: string;
  fridgeId: string;
  ownerId: string;
  name: string;
  quantity: string;
  ownership?: string;
  isRunningLow: boolean;
}

export const InventoryItemApi = {
  getItems(fridgeId: string) {
    return axios.get<PaginatedResponse<InventoryItemDto>>(
      `${API_BASE_URL}/fridges/${fridgeId}/items?limit=500`,
      {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      }
    );
  },
};
