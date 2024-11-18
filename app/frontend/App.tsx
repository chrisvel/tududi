import React, { useEffect, useState } from "react";
import {
  Routes,
  Route,
  useNavigate,
  Navigate,
  useLocation,
} from "react-router-dom";
import Login from "./components/Login";
import Tasks from "./components/Tasks";
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
import { DataProvider } from "./contexts/DataContext";
import { User } from "./entities/User";
import TasksToday from "./components/Task/TasksToday";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
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
      navigate("/today", { replace: true }); // Navigate to /today instead of /tasks?type=today
    }
  }, [currentUser, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <DataProvider>
      {currentUser ? (
        <Layout
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
        >
          <Routes>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TasksToday />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/project/:id" element={<ProjectDetails />} />
            <Route path="/areas" element={<Areas />} />
            <Route path="/area/:id" element={<AreaDetails />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/tag/:id" element={<TagDetails />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/note/:id" element={<NoteDetails />} />
            <Route
              path="/profile"
              element={<ProfileSettings currentUser={currentUser} />}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      ) : (
        <Login />
      )}
    </DataProvider>
  );
};

export default App;
