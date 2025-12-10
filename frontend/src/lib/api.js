/**
 * API Client configured with base URL from environment
 * In development: uses Vite proxy (empty base URL)
 * In production: uses VITE_API_URL environment variable
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Get the full URL for EventSource connections
 * @param {string} path - API path starting with /api/
 * @returns {string} Full URL for EventSource
 */
export function getEventSourceUrl(path) {
  return `${API_BASE}${path}`;
}

export default api;
