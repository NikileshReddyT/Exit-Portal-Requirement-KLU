import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import config from '../config';
import { useAuth } from './AuthContext';

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
  const { user } = useAuth();

  // Consolidated effect to manage program context from URL and session storage
  useEffect(() => {
    // For ADMIN users, ignore URL-based selection entirely; their scope is fixed to their assigned program.
    if (user?.userType === 'ADMIN') return;
    const urlParams = new URLSearchParams(location.search);
    const urlProgramCode = urlParams.get('programCode');
    const urlProgramId = urlParams.get('programId');

    // If a program identifier is in the URL, it's the source of truth.
    if (urlProgramId && urlProgramId !== selectedProgramId) {
        // When program is changed via URL, clear old info and set new ID.
        // The component using this context (e.g., AdminOverview) is responsible for fetching the new programInfo.
        setSelectedProgramId(urlProgramId);
        setProgramInfo(null); 
        sessionStorage.setItem('selectedProgramId', urlProgramId);
        sessionStorage.removeItem('programInfo');
    } else if (urlProgramCode) {
      // When only programCode is provided in the URL (no programId), hydrate programInfo.code
      // so that upload pages can immediately use the code without waiting for a fetch.
      if (!programInfo || programInfo.code !== urlProgramCode) {
        const updated = { ...(programInfo || {}), code: urlProgramCode };
        setProgramInfo(updated);
        sessionStorage.setItem('programInfo', JSON.stringify(updated));
      }
    }
  }, [location.search, selectedProgramId, programInfo, user]);

  // Keep ProgramContext synchronized with the authenticated user
  useEffect(() => {
    // If no user (logged out) or not admin/super-admin, clear the program context
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      setSelectedProgramId(null);
      setProgramInfo(null);
      sessionStorage.removeItem('selectedProgramId');
      sessionStorage.removeItem('programInfo');
      return;
    }

    // For ADMIN: force program to the user's assigned program
    if (user.userType === 'ADMIN') {
      const adminPid = user.programId ? String(user.programId) : null;
      if (adminPid && adminPid !== selectedProgramId) {
        setSelectedProgramId(adminPid);
        sessionStorage.setItem('selectedProgramId', adminPid);
      }
      const desiredInfo = {
        programId: user.programId ?? null,
        code: user.programCode ?? (programInfo?.code || null),
        name: user.programName ?? (programInfo?.name || null),
      };
      // Only update if changed to avoid re-renders
      if (JSON.stringify(desiredInfo) !== JSON.stringify(programInfo)) {
        setProgramInfo(desiredInfo);
        sessionStorage.setItem('programInfo', JSON.stringify(desiredInfo));
      }
    }
    // For SUPER_ADMIN: no action here; URL-based effect manages selection
  }, [user]);

  // Lazy hydrate programInfo from backend when we know selectedProgramId but don't yet have info
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (selectedProgramId && (!programInfo || !programInfo.code)) {
        try {
          const res = await fetch(`${config.backendUrl}/api/v1/admin/programs/${selectedProgramId}`, {
            credentials: 'include',
          });
          if (!res.ok) return;
          const data = await res.json();
          if (!cancelled) {
            setProgramInfo(data);
            sessionStorage.setItem('programInfo', JSON.stringify(data));
          }
        } catch {}
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedProgramId]);

  const setProgramContext = (programId, programData) => {
    
    const newProgramId = programId?.toString() || null;
    
    // Update state only if there's a change
    if (newProgramId && newProgramId !== selectedProgramId) {
      setSelectedProgramId(newProgramId);
      sessionStorage.setItem('selectedProgramId', newProgramId);
    }

    if (programData && JSON.stringify(programData) !== JSON.stringify(programInfo)) {
      setProgramInfo(programData);
      sessionStorage.setItem('programInfo', JSON.stringify(programData));
    }
  };

  const clearProgramContext = () => {
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

