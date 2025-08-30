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
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setIsAuthenticated(true);
        }
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
            
            console.log('[AuthContext] Login response:', loginResponse.data);

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
                
                console.log('[AuthContext] Setting user data:', userData);
                
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
    };

    // This function allows other parts of the app (like DataContext) to add info to the user object.
    const updateUser = useCallback((updates) => {
        console.log('[AuthContext] Attempting to update user with:', updates);
        setUser(prevUser => {
            if (!prevUser) {
                console.log('[AuthContext] No previous user state to update.');
                return null;
            }
            const updatedUser = { ...prevUser, ...updates };
            console.log('[AuthContext] User state updated:', updatedUser);
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
