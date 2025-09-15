import React from 'react';
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { HelmetProvider } from 'react-helmet-async';

createRoot(document.getElementById("root")).render(
  <HelmetProvider>
    <AuthProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </AuthProvider>
  </HelmetProvider>
);
