import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Login from './components/Login';
import Register from './components/Register';
import NotFound from './components/Shared/NotFound';
import ProjectDetails from './components/Project/ProjectDetails';
import Projects from './components/Projects';
import AreaDetails from './components/Area/AreaDetails';
import Areas from './components/Areas';
import TagDetails from './components/Tag/TagDetails';
import Tags from './components/Tags';
import Views from './components/Views';
import ViewDetail from './components/ViewDetail';
import Notes from './components/Notes';
import NoteDetails from './components/Note/NoteDetails';
import Calendar from './components/Calendar';
import ProfileSettings from './components/Profile/ProfileSettings';
import About from './components/About';
import Layout from './Layout';
import { User } from './entities/User';
import TasksToday from './components/Task/TasksToday';
import TaskDetails from './components/Task/TaskDetails';
import LoadingScreen from './components/Shared/LoadingScreen';
import InboxItems from './components/Inbox/InboxItems';
import { setCurrentUser as setUserInStorage } from './utils/userUtils';
import { getApiPath, getLocalesPath } from './config/paths';
// Lazy load Tasks component to prevent issues with tags loading
const Tasks = lazy(() => import('./components/Tasks'));

const App: React.FC = () => {
    const { i18n } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    if (!i18n.isInitialized) {
        return <LoadingScreen />;
    }

    const fetchCurrentUser = async () => {
        try {
            const response = await fetch(getApiPath('current_user'), {
                credentials: 'include',
                headers: {
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    setCurrentUser(null);
                    return;
                }
                throw new Error(`Failed to fetch user: ${response.status}`);
            }

            const data = await response.json();
            if (data.user) {
                setCurrentUser(data.user);
                setUserInStorage(data.user);
            } else {
                setCurrentUser(null);
                setUserInStorage(null);
            }
        } catch {
            setCurrentUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fetch user on mount
        fetchCurrentUser();
    }, []);

    // Listen for login events to update user state
    useEffect(() => {
        const handleUserLoggedIn = (event: CustomEvent) => {
            const user = event.detail;
            setCurrentUser(user);
            setUserInStorage(user);
        };

        window.addEventListener(
            'userLoggedIn',
            handleUserLoggedIn as EventListener
        );
        return () =>
            window.removeEventListener(
                'userLoggedIn',
                handleUserLoggedIn as EventListener
            );
    }, []);

    useEffect(() => {
        if (i18n.isInitialized) {
            fetch(getLocalesPath(`${i18n.language}/translation.json`))
                .then((response) => {
                    return response.json();
                })
                .then((data) => {
                    i18n.addResourceBundle(
                        i18n.language,
                        'translation',
                        data,
                        true,
                        true
                    );
                })
                .catch((error) => {
                    console.error(
                        'Error manually fetching translation file:',
                        error
                    );
                });
        }
    }, [i18n.isInitialized]);

    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        const storedPreference = localStorage.getItem('isDarkMode');
        return storedPreference !== null
            ? storedPreference === 'true'
            : window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    const toggleDarkMode = () => {
        const newValue = !isDarkMode;
        setIsDarkMode(newValue);
        localStorage.setItem('isDarkMode', JSON.stringify(newValue));
    };

    useEffect(() => {
        const updateTheme = () => {
            document.documentElement.classList.toggle('dark', isDarkMode);
        };
        updateTheme();

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const mediaListener = (e: MediaQueryListEvent) => {
            if (!localStorage.getItem('isDarkMode')) {
                setIsDarkMode(e.matches);
            }
        };
        mediaQuery.addEventListener('change', mediaListener);
        return () => mediaQuery.removeEventListener('change', mediaListener);
    }, [isDarkMode]);

    const LoadingComponent = () => (
        <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
            <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                {i18n.t(
                    'common.loading',
                    'Loading application... Please wait.'
                )}
            </div>
        </div>
    );

    if (loading) {
        return <LoadingComponent />;
    }

    return (
        <Suspense fallback={<LoadingComponent />}>
            <Routes>
                {currentUser ? (
                    <>
                        <Route
                            element={
                                <Layout
                                    currentUser={currentUser}
                                    setCurrentUser={setCurrentUser}
                                    isDarkMode={isDarkMode}
                                    toggleDarkMode={toggleDarkMode}
                                >
                                    <Outlet />
                                </Layout>
                            }
                        >
                            <Route
                                index
                                element={<Navigate to="/today" replace />}
                            />
                            <Route path="/today" element={<TasksToday />} />
                            <Route
                                path="/task/:uid"
                                element={<TaskDetails />}
                            />
                            <Route
                                path="/upcoming"
                                element={
                                    <Suspense
                                        fallback={
                                            <div className="p-4">
                                                {i18n.t(
                                                    'common.loading',
                                                    'Loading...'
                                                )}
                                            </div>
                                        }
                                    >
                                        <Tasks />
                                    </Suspense>
                                }
                            />
                            <Route
                                path="/tasks"
                                element={
                                    <Suspense
                                        fallback={
                                            <div className="p-4">
                                                {i18n.t(
                                                    'common.loading',
                                                    'Loading...'
                                                )}
                                            </div>
                                        }
                                    >
                                        <Tasks />
                                    </Suspense>
                                }
                            />
                            <Route path="/inbox" element={<InboxItems />} />
                            <Route path="/projects" element={<Projects />} />
                            <Route
                                path="/project/:uidSlug"
                                element={<ProjectDetails />}
                            />
                            <Route path="/areas" element={<Areas />} />
                            <Route path="/area/:id" element={<AreaDetails />} />
                            <Route path="/tags" element={<Tags />} />
                            <Route
                                path="/tag/:uidSlug"
                                element={<TagDetails />}
                            />
                            <Route path="/views" element={<Views />} />
                            <Route
                                path="/views/:uid"
                                element={<ViewDetail />}
                            />
                            <Route path="/notes" element={<Notes />} />
                            <Route path="/notes/:uid" element={<Notes />} />
                            <Route
                                path="/note/:uidSlug"
                                element={<NoteDetails />}
                            />
                            <Route path="/calendar" element={<Calendar />} />
                            <Route
                                path="/profile"
                                element={
                                    <ProfileSettings
                                        currentUser={currentUser}
                                        isDarkMode={isDarkMode}
                                        toggleDarkMode={toggleDarkMode}
                                    />
                                }
                            />
                            <Route
                                path="/about"
                                element={<About isDarkMode={isDarkMode} />}
                            />
                            <Route
                                path="/admin/users"
                                element={
                                    currentUser?.is_admin === true ? (
                                        <React.Suspense
                                            fallback={
                                                <div className="p-4">
                                                    Loading...
                                                </div>
                                            }
                                        >
                                            {React.createElement(
                                                React.lazy(
                                                    () =>
                                                        import(
                                                            './components/Admin/AdminUsersPage'
                                                        )
                                                )
                                            )}
                                        </React.Suspense>
                                    ) : (
                                        <Navigate to="/today" replace />
                                    )
                                }
                            />
                            <Route path="*" element={<NotFound />} />
                        </Route>
                    </>
                ) : (
                    <>
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route
                            path="/"
                            element={<Navigate to="/login" replace />}
                        />
                        <Route
                            path="*"
                            element={<Navigate to="/login" replace />}
                        />
                    </>
                )}
            </Routes>
        </Suspense>
    );
};

export default App;
