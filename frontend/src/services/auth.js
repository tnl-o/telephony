import axios from 'axios';

const API_BASE = '/api';

export const authAPI = {
  login: async (username, password) => {
    const response = await axios.post(`${API_BASE}/auth/login`, { username, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: async () => {
    await axios.post(`${API_BASE}/auth/logout`);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    try {
      const response = await axios.get(`${API_BASE}/user/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return null;
    }
  }
};

export const contactsAPI = {
  getAll: async () => {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_BASE}/contacts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }
};

export const adminAPI = {
  updateExtension: async (username, extension) => {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_BASE}/admin/user/${username}/extension`,
      { extension },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  getStats: async () => {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_BASE}/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }
};
