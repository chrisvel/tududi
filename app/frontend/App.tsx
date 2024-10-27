import React, { useEffect, useLayoutEffect, useState } from "react";
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

interface User {
  email: string;
  id: number;
  avatarUrl?: string;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const storedPreference = localStorage.getItem("isDarkMode");
    if (storedPreference !== null) {
      return storedPreference === "true";
    } else {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
  });

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

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem("isDarkMode") === null) {
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (currentUser && location.pathname === "/") {
      const options = {
        path: "/tasks?type=today",
        title: "Today",
        icon: "calendar", 
      };
      navigate(options.path, {
        state: {
          title: options.title,
          icon: options.icon, 
        },
        replace: true,
      });
    }
  }, [currentUser, location.pathname, navigate]);

  const toggleDarkMode = () => {
    const newValue = !isDarkMode;
    setIsDarkMode(newValue);
    localStorage.setItem("isDarkMode", JSON.stringify(newValue));
  };

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
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
        >
          <Routes>
            <Route path="/" element={<Navigate to="/tasks" replace />} />
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
