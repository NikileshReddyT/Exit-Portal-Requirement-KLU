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
            // Step 1: Authenticate the user
            const loginResponse = await axios.post(`${config.backendUrl}/api/v1/frontend/login`, {
                universityId: credentials.universityId,
                password: credentials.password
            });

            if (loginResponse.data && loginResponse.data.universityid) {
                const universityId = loginResponse.data.universityid;
                console.log(`[AuthContext] Login successful for universityId: ${universityId}`);

                // Step 2: Fetch student data to get the name
                console.log('[AuthContext] Fetching student details...');
                const dataResponse = await axios.post(`${config.backendUrl}/api/v1/frontend/getdata`, { universityid: universityId });

                let studentName = null;
                if (dataResponse.data && dataResponse.data.length > 0) {
                    studentName = dataResponse.data[0].studentName;
                    console.log(`[AuthContext] Found student name: "${studentName}"`);
                }

                // Step 3: Create a complete user object and update the state
                const userData = { universityId, name: studentName };
                console.log('[AuthContext] Setting complete user object:', userData);
                
                setUser(userData);
                setIsAuthenticated(true);
                localStorage.setItem('user', JSON.stringify(userData));
                
                return true; // Indicate success
            }
            return false; // Indicate login failure
        } catch (err) {
            console.error('[AuthContext] Login process failed:', err);
            // Re-throw the error so the UI component can catch it and display a message
            throw err;
        }
    };

    const logout = () => {
        
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
