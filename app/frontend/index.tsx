// src/index.tsx

import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom'; // Import BrowserRouter
import App from './App';

// Determine initial dark mode preference
const storedPreference = localStorage.getItem('isDarkMode');
const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
const isDarkMode = storedPreference ? storedPreference === 'true' : prefersDarkMode;

// Add or remove the 'dark' class before rendering the app
if (isDarkMode) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

ReactDOM.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
  document.getElementById('root')
);
