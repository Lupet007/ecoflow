// Single source of truth for the backend's base URL. Falls back to the local
// dev backend so nothing changes for local development - only setting the
// VITE_API_URL environment variable in the hosting provider's dashboard
// switches this to the deployed backend.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
