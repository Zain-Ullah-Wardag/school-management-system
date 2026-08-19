import axios, { AxiosError } from 'axios';
import type { ApiResponse } from '../types';
import { resolveApiBaseUrl } from './runtime';

export const api = axios.create({ baseURL: resolveApiBaseUrl(), timeout: 20000, headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use((config) => { const token = localStorage.getItem('school_erp_token'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
export const unwrap = <T>(response: { data: ApiResponse<T> }) => response.data.data;
export const apiError = (error: unknown) => {
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message || axiosError.message || 'Something went wrong. Please try again.';
};
