import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const raw = error.response?.data?.message;
    const message = Array.isArray(raw) ? raw.join(' ') : raw || 'Não foi possível concluir a ação.';
    const wrapped = new Error(message) as Error & { status?: number };
    wrapped.status = error.response?.status;
    return Promise.reject(wrapped);
  },
);
