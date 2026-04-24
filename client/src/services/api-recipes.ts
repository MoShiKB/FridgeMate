import axios from 'axios';
import { API_BASE_URL, api, tokenManager } from './api';

const getToken = () => localStorage.getItem('accessToken');

const auth = () => ({
  headers: { Authorization: `Bearer ${getToken()}` },
  withCredentials: true,
});

async function withRefresh<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (err?.response?.status !== 401) throw err;
    const refresh = tokenManager.getRefreshToken();
    if (!refresh) { tokenManager.clearTokens(); window.location.href = '/'; throw err; }
    try {
      const { accessToken } = await api.refreshToken(refresh);
      localStorage.setItem('accessToken', accessToken);
      return await fn();
    } catch {
      tokenManager.clearTokens();
      window.location.href = '/';
      throw err;
    }
  }
}

export interface RecipeNutrition {
  calories?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
}

export interface Recipe {
  _id: string;
  title: string;
  description?: string;
  cookingTime?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  ingredients?: { name: string; amount: string }[];
  steps?: string[];
  nutrition?: RecipeNutrition;
  imageUrl?: string;
  isFavorited?: boolean;
}

export const RecipeApi = {
  getRecommended: () =>
    withRefresh(async () => {
      const fridgeRes = await axios.get(`${API_BASE_URL}/fridges/me`, auth());
      const fridge = fridgeRes.data.data;
      if (!fridge?._id) return [] as Recipe[];

      const itemsRes = await axios.get(`${API_BASE_URL}/fridges/${fridge._id}/items`, auth());
      const items: { name: string }[] = itemsRes.data.items || [];
      const ingredientNames = items.map((i) => i.name).filter(Boolean);
      if (ingredientNames.length === 0) return [] as Recipe[];

      const genRes = await axios.post(
        `${API_BASE_URL}/ai/recipes/generate`,
        { ingredients: ingredientNames, count: 6 },
        auth()
      );
      return genRes.data.recipes as Recipe[];
    }),

  getFavorites: (page = 1, limit = 20) =>
    withRefresh(async () => {
      const res = await axios.get(`${API_BASE_URL}/recipes/favorites`, {
        ...auth(),
        params: { page, limit },
      });
      return res.data as { items: Recipe[]; total: number };
    }),

  addFavorite: (id: string) =>
    withRefresh(async () => {
      const res = await axios.post(`${API_BASE_URL}/recipes/${id}/favorite`, {}, auth());
      return res.data;
    }),

  removeFavorite: (id: string) =>
    withRefresh(async () => {
      const res = await axios.delete(`${API_BASE_URL}/recipes/${id}/favorite`, auth());
      return res.data;
    }),
    
    getById: (id: string) =>
  withRefresh(async () => {
    const res = await axios.get(`${API_BASE_URL}/recipes/${id}`, auth());
    return res.data as Recipe;
  }),
};
