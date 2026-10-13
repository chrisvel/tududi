import React, { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import BlogIndexPage from './BlogIndexPage';
import BlogPostPage from './BlogPostPage';

interface BlogAppProps {
    // '' at the root of the blog host, '/blog' inside the app.
    basePath: string;
    // Inside the app the theme belongs to the app; on the blog host the
    // blog keeps its own, under the same stored preference.
    isDarkMode?: boolean;
    toggleDarkMode?: () => void;
}

const storedDarkMode = (): boolean => {
    const stored = localStorage.getItem('isDarkMode');
    if (stored !== null) return stored === 'true';
    return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
};

// The blog: a front page note and the public notes it links. Readers need
// no account; every page leads to tududi Cloud.
const BlogApp: React.FC<BlogAppProps> = ({
    basePath,
    isDarkMode,
    toggleDarkMode,
}) => {
    const controlled = isDarkMode !== undefined && !!toggleDarkMode;
    const [ownDarkMode, setOwnDarkMode] = useState<boolean>(() =>
        controlled ? false : storedDarkMode()
    );
    const dark = controlled ? isDarkMode : ownDarkMode;

    useEffect(() => {
        if (controlled) return;
        document.documentElement.classList.toggle('dark', ownDarkMode);
    }, [controlled, ownDarkMode]);

    const toggle = () => {
        if (controlled) {
            toggleDarkMode();
            return;
        }
        const next = !ownDarkMode;
        localStorage.setItem('isDarkMode', JSON.stringify(next));
        setOwnDarkMode(next);
    };

    const page = { basePath, isDarkMode: dark, toggleDarkMode: toggle };

    return (
        <Routes>
            <Route index element={<BlogIndexPage {...page} />} />
            <Route path=":slug" element={<BlogPostPage {...page} />} />
        </Routes>
    );
};

export default BlogApp;
