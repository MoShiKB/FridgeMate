import axios from "axios";
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});
export default apiClient;

interface LoginResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
}

interface RegisterResponse {
  message: string;
  user: {
    _id: string;
    userName: string;
    email: string;
    profileImage: string | null;
    role: string;
    createdAt: string;
    updatedAt: string;
  };
}

interface ApiError {
  message: string;
  status: number;
}

class ApiService {
  private async handleResponse(response: Response) {
    // Read the body once as text
    const text = await response.text();
    
    let data;
    try {
      // Try to parse as JSON
      data = JSON.parse(text);
    } catch {
      // If parsing fails, treat as plain text
      data = { message: text };
    }

    if (!response.ok) {
      throw {
        message: data.message || text || 'An error occurred',
        status: response.status,
      } as ApiError;
    }

    return data;
  }

  async register(
    fullName: string,
    email: string,
    password: string
  ): Promise<RegisterResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userName: fullName,
        displayName: fullName,
        email,
        password,
      }),
    });

    return this.handleResponse(response);
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    return this.handleResponse(response);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    return this.handleResponse(response);
  }

  async resetPassword(
    email: string,
    code: string,
    password: string
  ): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, code, newPassword: password }),
    });

    return this.handleResponse(response);
  }

  async logout(accessToken: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    return this.handleResponse(response);
  }

  async getUsers(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/user`, {
      headers: {
        'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
      },
    });
    return this.handleResponse(response);
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    return this.handleResponse(response);
  }
}

export const api = new ApiService();

// Token management utilities
export const tokenManager = {
  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  },

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  },

  clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },
};
