import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import config from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        // On initial load, check localStorage to see if the user is already logged in.
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('authToken');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setIsAuthenticated(true);
        }
        // If a token exists (e.g., on Safari where cookies might be blocked), set it on axios
        if (storedToken) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
        // Always send credentials to allow cookie-based auth in browsers that support it
        axios.defaults.withCredentials = true;
    }, []);

    const login = async (credentials) => {
        try {
            // Unified login endpoint - handles both student and admin authentication
            const loginResponse = await axios.post(`${config.backendUrl}/api/v1/frontend/login`, {
                universityId: credentials.universityId,
                password: credentials.password
            }, {
                withCredentials: true // Important for cookies
            });
            

            if (loginResponse.data) {
                const userData = {
                    userType: loginResponse.data.userType,
                    role: loginResponse.data.role,
                    ...(loginResponse.data.userType === 'STUDENT' ? {
                        universityId: loginResponse.data.universityId,
                        name: loginResponse.data.studentName
                    } : {
                        username: loginResponse.data.username,
                        name: loginResponse.data.name,
                        programId: loginResponse.data.programId,
                        programCode: loginResponse.data.programCode,
                        programName: loginResponse.data.programName
                    })
                };
                
                // Step C: Use Authorization header as a fallback for Safari or any browser blocking cookies
                const token = loginResponse.data.token;
                const tokenType = loginResponse.data.tokenType || 'Bearer';
                if (token) {
                    axios.defaults.headers.common['Authorization'] = `${tokenType} ${token}`;
                    localStorage.setItem('authToken', token);
                }
                
                setUser(userData);
                setIsAuthenticated(true);
                localStorage.setItem('user', JSON.stringify(userData));
                
                return userData; // Return user data for routing decisions
            }
            return false;
        } catch (err) {
            console.error('[AuthContext] Login process failed:', err);
            throw err;
        }
    };

    const logout = async () => {
        try {
            // Clear JWT cookie by making a request to backend
            await axios.post(`${config.backendUrl}/api/v1/frontend/logout`, {}, {
                withCredentials: true
            });
        } catch (error) {
            console.error('Logout request failed:', error);
        }
        
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('user');
        localStorage.removeItem('studentId'); // Also clear the old studentId for safety
        // Remove token and header (Step C cleanup)
        localStorage.removeItem('authToken');
        delete axios.defaults.headers.common['Authorization'];
    };

    // This function allows other parts of the app (like DataContext) to add info to the user object.
    const updateUser = useCallback((updates) => {
        setUser(prevUser => {
            if (!prevUser) {
                return null;
            }
            const updatedUser = { ...prevUser, ...updates };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            return updatedUser;
        });
    }, []);

    const value = {
        user,
        isAuthenticated,
        login,
        logout,
        updateUser
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    return useContext(AuthContext);
};
