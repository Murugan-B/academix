import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // adjust this if your backend runs on a different port
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the JWT token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let customError = 'Something went wrong on the server. Please try again.';

    if (!error.response) {
      customError = 'Unable to connect to the Academix server. Please make sure the backend server is running on port 5000.';
    } else {
      const status = error.response.status;
      if (status === 401) {
        customError = 'Your session has expired. Please log in again.';
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else if (status === 403) {
        customError = 'You do not have permission to perform this action.';
      } else if (status === 404) {
        customError = 'Requested academic resource was not found.';
      } else if (status === 422) {
        customError = error.response.data.error || 'Invalid data provided.';
      } else if (error.response.data && error.response.data.error) {
        customError = error.response.data.error;
      }
    }
    
    // Instead of throwing the raw error, we can attach the custom message
    const formattedError = new Error(customError);
    formattedError.response = error.response;
    formattedError.isCustom = true;
    
    return Promise.reject(formattedError);
  }
);

export default api;
