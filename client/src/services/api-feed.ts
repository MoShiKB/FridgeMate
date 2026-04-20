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

export interface PostAuthor {
  _id: string;
  displayName: string;
  profileImage?: string;
  address?: { city?: string };
}

export interface PostLocation {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
  placeName?: string;
}

export interface Post {
  _id: string;
  authorUserId: PostAuthor;
  title: string;
  text: string;
  mediaUrls: string[];
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isOwner: boolean;
  createdAt: string;
  recipeId?: { title: string; imageUrl: string } | null;
  location?: PostLocation | null;
}

export interface Comment {
  _id: string;
  authorUserId: { _id: string; displayName: string; profileImage?: string };
  text: string;
  createdAt: string;
  isOwner: boolean;
}

export const FeedApi = {
  getPosts: (page = 1, limit = 20, location?: { lat: number; lng: number; radiusKm?: number }) =>
    withRefresh(async () => {
      const res = await axios.get(`${API_BASE_URL}/posts`, { ...auth(), params: { page, limit, ...location } });
      return res.data as { items: Post[]; total: number };
    }),

  getMyPosts: () =>
    withRefresh(async () => {
      const res = await axios.get(`${API_BASE_URL}/posts/me`, auth());
      return res.data as { items: Post[]; total: number };
    }),

  toggleLike: (postId: string) =>
    withRefresh(async () => {
      const res = await axios.post(`${API_BASE_URL}/posts/${postId}/like`, {}, auth());
      return res.data.data as { liked: boolean; likesCount: number };
    }),

  getComments: (postId: string) =>
    withRefresh(async () => {
      const res = await axios.get(`${API_BASE_URL}/posts/${postId}/comments`, auth());
      return res.data.data as { items: Comment[] };
    }),

  addComment: (postId: string, text: string) =>
    withRefresh(async () => {
      const res = await axios.post(`${API_BASE_URL}/posts/${postId}/comments`, { text }, auth());
      return res.data.data as Comment;
    }),

  deleteComment: (postId: string, commentId: string) =>
    withRefresh(() => axios.delete(`${API_BASE_URL}/posts/${postId}/comments/${commentId}`, auth())),

  createPost: (data: { title: string; text: string; mediaUrls?: string[]; location?: { lat: number; lng: number; placeName?: string } }) =>
    withRefresh(async () => {
      const res = await axios.post(`${API_BASE_URL}/posts`, data, auth());
      return res.data.data as Post;
    }),

  deletePost: (postId: string) =>
    withRefresh(() => axios.delete(`${API_BASE_URL}/posts/${postId}`, auth())),
};
