import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ProgramContext = createContext();

export const useProgramContext = () => {
  const context = useContext(ProgramContext);
  if (!context) {
    throw new Error('useProgramContext must be used within a ProgramProvider');
  }
  return context;
};

export const ProgramProvider = ({ children }) => {
  const [selectedProgramId, setSelectedProgramId] = useState(() => sessionStorage.getItem('selectedProgramId') || null);
  const [programInfo, setProgramInfo] = useState(() => {
    const storedInfo = sessionStorage.getItem('programInfo');
    try {
      return storedInfo ? JSON.parse(storedInfo) : null;
    } catch (e) {
      console.error('Failed to parse stored program info on init:', e);
      return null;
    }
  });
  const location = useLocation();

  // Consolidated effect to manage program context from URL and session storage
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const urlProgramCode = urlParams.get('programCode');
    const urlProgramId = urlParams.get('programId');

    // If a program identifier is in the URL, it's the source of truth.
    if (urlProgramId && urlProgramId !== selectedProgramId) {
        console.log(`ProgramContext - Syncing from URL programId: ${urlProgramId}`);
        // When program is changed via URL, clear old info and set new ID.
        // The component using this context (e.g., AdminOverview) is responsible for fetching the new programInfo.
        setSelectedProgramId(urlProgramId);
        setProgramInfo(null); 
        sessionStorage.setItem('selectedProgramId', urlProgramId);
        sessionStorage.removeItem('programInfo');
    }
  }, [location.search, selectedProgramId]);

  const setProgramContext = (programId, programData) => {
    console.log('ProgramContext - setProgramContext called with:', { programId, programData });
    
    const newProgramId = programId?.toString() || null;
    
    // Update state only if there's a change
    if (newProgramId && newProgramId !== selectedProgramId) {
      setSelectedProgramId(newProgramId);
      sessionStorage.setItem('selectedProgramId', newProgramId);
      console.log(`ProgramContext - Set programId to: ${newProgramId}`);
    }

    if (programData && JSON.stringify(programData) !== JSON.stringify(programInfo)) {
      setProgramInfo(programData);
      sessionStorage.setItem('programInfo', JSON.stringify(programData));
      console.log('ProgramContext - Set programInfo to:', programData);
    }
  };

  const clearProgramContext = () => {
    console.log('ProgramContext - Clearing program context.');
    setSelectedProgramId(null);
    setProgramInfo(null);
    sessionStorage.removeItem('selectedProgramId');
    sessionStorage.removeItem('programInfo');
  };

  const value = {
    selectedProgramId,
    programInfo,
    setProgramContext,
    clearProgramContext,
    isInProgramContext: !!selectedProgramId,
  };

  return (
    <ProgramContext.Provider value={value}>
      {children}
    </ProgramContext.Provider>
  );
};
