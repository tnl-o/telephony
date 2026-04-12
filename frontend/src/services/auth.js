import axios from 'axios';

const API_BASE = '/api';

export const authAPI = {
  login: async (username, password) => {
    const response = await axios.post(`${API_BASE}/auth/login`, { username, password });
    if (response.data.user) {
      const sc = response.data.sipCredentials;
      sessionStorage.setItem(
        'user',
        JSON.stringify({
          ...response.data.user,
          sipPassword: sc?.password,
          wssUrl: sc?.wssUrl,
          sipDomain: sc?.domain
        })
      );
    }
    return response.data;
  },

  logout: async () => {
    const raw = sessionStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    if (user?.username) {
      try {
        await axios.post(`${API_BASE}/auth/logout`, { username: user.username });
      } catch (_) {
        /* ignore network errors on logout */
      }
    }
    sessionStorage.removeItem('user');
  },

  getCurrentUser: async () => {
    const raw = sessionStorage.getItem('user');
    if (!raw) return null;
    try {
      const user = JSON.parse(raw);
      return { user };
    } catch {
      sessionStorage.removeItem('user');
      return null;
    }
  }
};

export const contactsAPI = {
  getAll: async () => {
    const response = await axios.get(`${API_BASE}/contacts`);
    return response.data;
  }
};

export const adminAPI = {
  updateExtension: async (username, extension) => {
    const response = await axios.post(`${API_BASE}/admin/user/${username}/extension`, {
      extension
    });
    return response.data;
  },

  getStats: async () => {
    const response = await axios.get(`${API_BASE}/stats`);
    return response.data;
  }
};
