import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Get the root element from the DOM
const container = document.getElementById('root');

// Use React 18's createRoot API
const root = createRoot(container!); // The '!' asserts that 'container' is not null

// Render the App component inside BrowserRouter
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
