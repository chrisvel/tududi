import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { mutate } from 'swr';
import App from './App';
import { ToastProvider } from './components/Shared/ToastContext';
import { TelegramStatusProvider } from './contexts/TelegramStatusContext';
import './i18n'; // Import i18n config to initialize it
import './styles/markdown.css'; // Import markdown styles
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n'; // Import the i18n instance with its configuration
import { getBasePath } from './config/paths';
import { captureSharedPayload } from './utils/shareTargetService';
import BlogApp from './components/Blog/BlogApp';

const isDevelopment = process.env.NODE_ENV !== 'production';

// On a blog host the server marks the shell, and the blog renders at the
// root in place of the app.
const isBlogSite =
    document
        .querySelector('meta[name="tududi-site"]')
        ?.getAttribute('content') === 'blog';

// Stash anything handed over by the OS share sheet and clean the URL before
// the router reads it (see share_target in public/manifest.json)
captureSharedPayload();

// The blog host has no app to cache or work offline.
if ('serviceWorker' in navigator && !isBlogSite) {
    if (!isDevelopment) {
        window.addEventListener('online', () => {
            navigator.serviceWorker.controller?.postMessage({
                type: 'REPLAY_QUEUE',
            });
        });
    }
    window.addEventListener('load', () => {
        // Development gets the worker only for push notifications; caching
        // and the offline queue would fight hot reloading.
        const swUrl = isDevelopment ? '/sw.js?push-only' : '/sw.js';
        navigator.serviceWorker
            .register(swUrl)
            .then((registration) => {
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (
                                newWorker.state === 'installed' &&
                                navigator.serviceWorker.controller
                            ) {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                            }
                        });
                    }
                });
            })
            .catch(() => {
                // Non-fatal: app functions without service worker
            });

        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'SYNC_COMPLETE') {
                mutate(() => true, undefined, { revalidate: true });
            }
        });
    });
}

// Clear out any lingering service workers/caches from other branches (e.g. PWA).
// The push-only worker registered above stays: unregistering it would also
// drop this browser's push subscription.
if (isDevelopment && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
            const worker =
                registration.active ||
                registration.waiting ||
                registration.installing;
            if (worker?.scriptURL.includes('push-only')) return;
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
                {isBlogSite ? (
                    <BlogApp basePath="" />
                ) : (
                    <ToastProvider>
                        <TelegramStatusProvider>
                            <App />
                        </TelegramStatusProvider>
                    </ToastProvider>
                )}
            </BrowserRouter>
        </I18nextProvider>
    );
}
