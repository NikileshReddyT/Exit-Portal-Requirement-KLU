import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import config from '../config';

const AuthContext = createContext(null);


export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        
        return null;
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
            const response = await axios.post(`${config.backendUrl}/api/v1/frontend/login`, {
                universityId: credentials.universityId,
                password: credentials.password
            });
            
            if (response.data && response.data.universityid) {
                const userData = { universityId: response.data.universityid };
                
                setUser(userData);
                setIsAuthenticated(true);
                localStorage.setItem('user', JSON.stringify(userData));
                return true;
            }
            return false;
        } catch (err) {
            
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
        
        setUser(prevUser => {
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
