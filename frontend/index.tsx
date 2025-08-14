// Add type declaration for module.hot
declare const module: {
    hot?: {
        accept: (path: string, callback: () => void) => void;
    };
};

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/Shared/ToastContext';
import { TelegramStatusProvider } from './contexts/TelegramStatusContext';
import './i18n'; // Import i18n config to initialize it
import './styles/markdown.css'; // Import markdown styles
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n'; // Import the i18n instance with its configuration

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New version available
                                if (confirm('New version available! Reload to update?')) {
                                    window.location.reload();
                                }
                            }
                        });
                    }
                });
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

const storedPreference = localStorage.getItem('isDarkMode');
const prefersDarkMode = window.matchMedia(
    '(prefers-color-scheme: dark)'
).matches;
const isDarkMode = storedPreference
    ? storedPreference === 'true'
    : prefersDarkMode;

if (isDarkMode) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

const container = document.getElementById('root');

// Store the root outside the if block so it can be accessed by the HMR code
let root: any;

if (container) {
    root = createRoot(container);
    root.render(
        <I18nextProvider i18n={i18n}>
            <BrowserRouter>
                <ToastProvider>
                    <TelegramStatusProvider>
                        <App />
                    </TelegramStatusProvider>
                </ToastProvider>
            </BrowserRouter>
        </I18nextProvider>
    );
}

// Hot Module Replacement (HMR) - Remove this snippet to remove HMR.
// Learn more: https://www.webpackjs.com/concepts/hot-module-replacement/
if (module.hot) {
    module.hot.accept('./App', () => {
        // New version of App component imported
        if (root) {
            root.render(
                <I18nextProvider i18n={i18n}>
                    <BrowserRouter>
                        <ToastProvider>
                            <TelegramStatusProvider>
                                <App />
                            </TelegramStatusProvider>
                        </ToastProvider>
                    </BrowserRouter>
                </I18nextProvider>
            );
        }
    });
}
