import axios from "axios";
const api = axios.create({ baseURL: "/api", withCredentials: true });
// Bodyless mutations still use JSON so the server can enforce its CSRF boundary.
api.interceptors.request.use((config) => {
  if (
    ["post", "put", "patch", "delete"].includes(config.method) &&
    config.data === undefined
  )
    config.data = {};
  return config;
});
api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401 && !e.config.url.includes("/auth/"))
      window.dispatchEvent(new Event("session-expired"));
    return Promise.reject(e);
  },
);
export const message = (e) =>
  e.response?.data?.message ||
  e.response?.data?.error ||
  "Unable to reach the server. Please try again.";
export default api;
