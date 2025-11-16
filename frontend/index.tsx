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
import { getBasePath } from './config/paths';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Clear out any lingering service workers/caches from other branches (e.g. PWA)
if (isDevelopment && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
            registration.unregister().catch(() => {
                // Non-fatal during development cleanup
            });
        });
    });

    if ('caches' in window) {
        caches.keys().then((cacheNames) => {
            cacheNames.forEach((cacheName) => {
                caches.delete(cacheName).catch(() => {
                    // Ignore cache cleanup failures during dev
                });
            });
        });
    }
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

if (container) {
    const root = createRoot(container);
    const basename = getBasePath();
    root.render(
        <I18nextProvider i18n={i18n}>
            <BrowserRouter basename={basename || undefined}>
                <ToastProvider>
                    <TelegramStatusProvider>
                        <App />
                    </TelegramStatusProvider>
                </ToastProvider>
            </BrowserRouter>
        </I18nextProvider>
    );
}
