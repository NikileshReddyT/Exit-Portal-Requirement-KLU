import axios from 'axios';

const config = {
    backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
};

// Configure axios to include cookies with all requests
axios.defaults.withCredentials = true;

export default config;
