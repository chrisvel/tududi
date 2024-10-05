// App.tsx
import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Layout from './Layout';
import Login from './Login';
import Tasks from './Tasks';
import NotFound from './NotFound';
import ProjectDetails from './components/Project/ProjectDetails';
import Projects from './components/Projects';


interface User {
  email: string;
  id: number;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if the user is logged in when the app loads
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/current_user');
        const data = await response.json();
        if (data.user) {
          setCurrentUser(data.user);
        } else {
          navigate('/login'); // If not logged in, redirect to login
        }
      } catch (err) {
        console.error('Failed to fetch current user:', err);
        navigate('/login');
      } finally {
        setLoading(false); // Stop loading once the user data is fetched
      }
    };

    fetchCurrentUser();
  }, [navigate]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      {/* Home route */}
      <Route
        path="/"
        element={
          currentUser ? (
            <Layout currentUser={currentUser}>
              <h1>Welcome back, {currentUser.email}</h1>
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
            <Layout currentUser={currentUser}>
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
            <Layout currentUser={currentUser}>
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
            <Layout currentUser={currentUser}>
              <ProjectDetails />
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
