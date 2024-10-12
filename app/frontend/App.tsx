import React, { useEffect, useLayoutEffect, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Layout from "./Layout";
import Login from "./Login";
import Tasks from "./Tasks";
import NotFound from "./NotFound";
import ProjectDetails from "./components/Project/ProjectDetails";
import EditProject from "./components/Project/EditProject";
import Projects from "./Projects";
import AreaDetails from "./components/Area/AreaDetails";
import Areas from "./Areas";
import TagDetails from "./components/Tag/TagDetails";
import Tags from "./Tags";
import Notes from "./Notes";
import NoteDetails from "./components/Note/NoteDetails";
import EditNote from "./components/Note/EditNote";
import ProfileSettings from "./components/Profile/ProfileSettings";

interface User {
  email: string;
  id: number;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize isDarkMode from localStorage or system preference
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const storedPreference = localStorage.getItem("isDarkMode");
    if (storedPreference !== null) {
      return storedPreference === "true";
    } else {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
  });

  const navigate = useNavigate();

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch("/api/current_user", {
          credentials: "include", // Include cookies for authentication
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

  // Apply or remove the 'dark' class on the root element
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Listen for system preference changes when no manual preference is set
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

  // Handle dark mode toggle
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
    <Routes>
      {/* Home route */}
      <Route
        path="/"
        element={
          currentUser ? (
            <Layout
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
            >
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Welcome back, {currentUser.email}
              </h1>
            </Layout>
          ) : (
            <Login />
          )
        }
      />

      {/* Tasks route */}
      <Route
        path="/tasks"
        element={
          currentUser ? (
            <Layout
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
            >
              <Tasks />
            </Layout>
          ) : (
            <Login />
          )
        }
      />

      {/* Projects route */}
      <Route
        path="/projects"
        element={
          currentUser ? (
            <Layout
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
            >
              <Projects />
            </Layout>
          ) : (
            <Login />
          )
        }
      />

      {/* Project details route */}
      <Route
        path="/project/:id"
        element={
          currentUser ? (
            <Layout
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
            >
              <ProjectDetails />
            </Layout>
          ) : (
            <Login />
          )
        }
      />

      {/* Areas List route */}
      <Route
        path="/areas"
        element={
          currentUser ? (
            <Layout
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
            >
              <Areas />
            </Layout>
          ) : (
            <Login />
          )
        }
      />

      {/* Area details route */}
      <Route
        path="/area/:id"
        element={
          currentUser ? (
            <Layout
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
            >
              <AreaDetails />
            </Layout>
          ) : (
            <Login />
          )
        }
      />

      {/* Tags List route */}
      <Route
        path="/tags"
        element={
          currentUser ? (
            <Layout
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
            >
              <Tags />
            </Layout>
          ) : (
            <Login />
          )
        }
      />

      {/* Tag details route */}
      <Route
        path="/tag/:id"
        element={
          currentUser ? (
            <Layout
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
            >
              <TagDetails />
            </Layout>
          ) : (
            <Login />
          )
        }
      />

      {/* Notes route */}
      <Route
        path="/notes"
        element={
          currentUser ? (
            <Layout
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
            >
              <Notes /> {/* Add Notes component */}
            </Layout>
          ) : (
            <Login />
          )
        }
      />

      <Route
        path="/note/:id"
        element={
          currentUser ? (
            <Layout
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
            >
              <NoteDetails />
            </Layout>
          ) : (
            <Login />
          )
        }
      />

      <Route
        path="/note/:id/edit"
        element={
          currentUser ? (
            <Layout
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
            >
              <EditNote />
            </Layout>
          ) : (
            <Login />
          )
        }
      />

      <Route
        path="/profile"
        element={
          currentUser ? (
            <Layout
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
            >
              <ProfileSettings currentUser={currentUser} />{" "}
              {/* Profile Settings Page */}
            </Layout>
          ) : (
            <Login />
          )
        }
      />

      {/* Login route */}
      <Route path="/login" element={<Login />} />

      {/* Catch-all route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default App;
