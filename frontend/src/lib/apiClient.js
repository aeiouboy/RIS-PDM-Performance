import axios from 'axios';

const apiClient = axios.create({
  baseURL: '',
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  if (!config.headers['Authorization']) {
    const token = localStorage.getItem('authToken') || '';
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
