import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import config from '../config';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

export const DataProvider = ({ children }) => {
    
    const { isAuthenticated, user, updateUser } = useAuth();
    

    const [studentProgressData, setStudentProgressData] = useState(null);
    const [fullReportData, setFullReportData] = useState(null);
    const [loadingProgress, setLoadingProgress] = useState('idle'); // idle | pending | succeeded | failed
    const [loadingReport, setLoadingReport] = useState('idle');
    const [error, setError] = useState(null);

    const fetchStudentProgress = useCallback(async () => {
        if (!user?.universityId) return;

        
        setLoadingProgress('pending');
        try {
            const response = await axios.post(`${config.backendUrl}/api/v1/frontend/getdata`, { universityid: user.universityId });
            
            setStudentProgressData(response.data);
            setLoadingProgress('succeeded');

            // Enrich the user object in AuthContext with the student's name
            if (response.data && response.data.length > 0) {
                updateUser({ name: response.data[0].studentName });
            }
        } catch (err) {
            
            setError('Failed to load student data.');
            setLoadingProgress('failed');
        }
    }, [user?.universityId, updateUser]);

    useEffect(() => {
        // Fetch data only when the user is authenticated and data hasn't been fetched yet.
        if (isAuthenticated && !studentProgressData) {
            fetchStudentProgress();
        }
        // If user logs out, clear the data.
        if (!isAuthenticated) {
            setStudentProgressData(null);
            setFullReportData(null);
        }
    }, [isAuthenticated, studentProgressData, fetchStudentProgress]);

    const fetchFullReport = async () => {
        if (!user?.universityId || fullReportData) return;

        setLoadingReport('pending');
        try {
            const response = await axios.get(`${config.backendUrl}/api/v1/frontend/generatereport/${user.universityId}`);
            setFullReportData(response.data);
            setLoadingReport('succeeded');
            return response.data;
        } catch (err) {
            
            setError('Failed to load report data.');
            setLoadingReport('failed');
        }
    };

    const value = {
        studentProgressData,
        fullReportData,
        loadingProgress,
        loadingReport,
        error,
        fetchFullReport,
        refetchStudentProgress: fetchStudentProgress // Expose a refetch function if needed
    };

    

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
    return useContext(DataContext);
};
