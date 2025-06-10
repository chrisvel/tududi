import React, { useEffect, useState, Suspense, lazy } from "react";
import {
  Routes,
  Route,
  useNavigate,
  Navigate,
  useLocation,
  Outlet
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import Login from "./components/Login";
import NotFound from "./components/Shared/NotFound";
import ProjectDetails from "./components/Project/ProjectDetails";
import Projects from "./components/Projects";
import AreaDetails from "./components/Area/AreaDetails";
import Areas from "./components/Areas";
import TagDetails from "./components/Tag/TagDetails";
import Tags from "./components/Tags";
import Notes from "./components/Notes";
import NoteDetails from "./components/Note/NoteDetails";
import ProfileSettings from "./components/Profile/ProfileSettings";
import Layout from "./Layout";
import { User } from "./entities/User";
import TasksToday from "./components/Task/TasksToday"; 
import LoadingScreen from "./components/Shared/LoadingScreen";
import InboxItems from "./components/Inbox/InboxItems";
// Lazy load Tasks component to prevent issues with tags loading
const Tasks = lazy(() => import("./components/Tasks"));

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  if (!i18n.isInitialized) {
    return <LoadingScreen />;
  }
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log("App component - i18n initialized:", i18n.isInitialized);
    console.log("App component - Current language:", i18n.language);
    console.log("App component - Has translation loaded:", i18n.hasResourceBundle(i18n.language, 'translation'));
    
    // Force reload translations for the current language
    if (i18n.isInitialized) {
      // Create a direct fetch to verify the translation file is accessible
      fetch(`/locales/${i18n.language}/translation.json`)
        .then(response => {
          console.log(`Translation file fetch response: ${response.status} ${response.statusText}`);
          if (!response.ok) {
            console.error(`Failed to fetch translation file: ${response.status} ${response.statusText}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("Translation file content retrieved manually:", Object.keys(data));
          // Force add the resource bundle
          i18n.addResourceBundle(i18n.language, 'translation', data, true, true);
          console.log("Resource bundle manually added for:", i18n.language);
        })
        .catch(error => {
          console.error("Error manually fetching translation file:", error);
        });
    }
    
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch("/api/current_user", {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });
        const data = await response.json();
        if (data.user) {
          setCurrentUser(data.user);
          
          // Set the language based on user's profile if available
          if (data.user.language) {
            console.log("Setting language from user profile:", data.user.language);
            i18n.changeLanguage(data.user.language)
              .then(() => {
                console.log("Language changed to:", i18n.language);
                // After changing language, verify resource bundle
                console.log("Has resource bundle after change:", 
                  i18n.hasResourceBundle(i18n.language, 'translation'));
              })
              .catch(err => console.error("Error changing language:", err));
          }
        } else {
          navigate("/login");
        }
      } catch (err) {
        console.error("Failed to fetch current user:", err);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, [navigate]);

  const toggleDarkMode = () => {
    const newValue = !isDarkMode;
    setIsDarkMode(newValue);
    localStorage.setItem("isDarkMode", JSON.stringify(newValue));
  };

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const storedPreference = localStorage.getItem("isDarkMode");
    return storedPreference !== null
      ? storedPreference === "true"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const updateTheme = () => {
      document.documentElement.classList.toggle("dark", isDarkMode);
    };
    updateTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const mediaListener = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("isDarkMode")) {
        setIsDarkMode(e.matches);
      }
    };
    mediaQuery.addEventListener("change", mediaListener);
    return () => mediaQuery.removeEventListener("change", mediaListener);
  }, [isDarkMode]);

  useEffect(() => {
    if (currentUser && location.pathname === "/") {
      navigate("/today", { replace: true });
    }
  }, [currentUser, location.pathname, navigate]);

  const LoadingComponent = () => (
    <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
      <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
        {i18n.t('common.loading', 'Loading application... Please wait.')}
      </div>
    </div>
  );

  if (loading) {
    return <LoadingComponent />;
  }

  return (
    <Suspense fallback={<LoadingComponent />}>
      <Routes>
        <Route path="/login" element={!currentUser ? <Login /> : <Navigate to="/today" replace />} />
        
        {/* Protected Routes */}
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
              <Route index element={<Navigate to="/today" replace />} />
              <Route path="/today" element={<TasksToday />} />
              <Route
                path="/tasks"
                element={
                  <Suspense fallback={<div className="p-4">{i18n.t('common.loading', 'Loading...')}</div>}>
                    <Tasks />
                  </Suspense>
                }
              />
              <Route path="/inbox" element={<InboxItems />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/project/:id" element={<ProjectDetails />} />
              <Route path="/areas" element={<Areas />} />
              <Route path="/area/:id" element={<AreaDetails />} />
              <Route path="/tags" element={<Tags />} />
              <Route path="/tag/:id" element={<TagDetails />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/note/:id" element={<NoteDetails />} />
              <Route path="/profile" element={<ProfileSettings currentUser={currentUser} />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </>
        ) : (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </Suspense>
  );
};

export default App;
