import axios from 'axios';

// 1. Point all requests to your backend server (override with VITE_API_URL)
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:2000/api/v1',
});

// 2. Export clean helper functions so React components can call them easily
export const fetchIssues = async (status = '') => {
  const url = status ? `/issues?status=${status}` : '/issues';
  const response = await API.get(url);
  return response.data; // Returns { success: true, data: [...] }
};

export const fetchIssueDetails = async (id) => {
  const response = await API.get(`/issues/${id}`);
  return response.data;
};

export const updateStatus = async (id, status) => {
  const response = await API.patch(`/issues/${id}/status`, { status });
  return response.data;
};

export default API;