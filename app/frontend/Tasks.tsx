import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import TaskList from './components/Task/TaskList';
import NewTask from './NewTask';
import { Task } from './entities/Task';
import { Project } from './entities/Project';

const getTitleAndIcon = (query: URLSearchParams, projects: Project[]) => {
  const projectId = query.get('project_id');
  if (projectId) {
    const project = projects.find((p) => p.id.toString() === projectId);
    return { title: project ? project.name : 'Project', icon: 'bi-folder-fill' };
  }

  if (query.get('type') === 'today') {
    return { title: 'Today', icon: 'bi-calendar-day-fill' };
  }
  if (query.get('type') === 'inbox') {
    return { title: 'Inbox', icon: 'bi-inbox-fill' };
  }
  if (query.get('type') === 'next') {
    return { title: 'Next Actions', icon: 'bi-arrow-right-circle-fill' };
  }
  if (query.get('type') === 'upcoming') {
    return { title: 'Upcoming', icon: 'bi-calendar3' };
  }
  if (query.get('type') === 'someday') {
    return { title: 'Someday', icon: 'bi-moon-stars-fill' };
  }
  if (query.get('status') === 'done') {
    return { title: 'Completed', icon: 'bi-check-circle' };
  }
  return { title: 'All Tasks', icon: 'bi-layers' };
};

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const { title: stateTitle, icon: stateIcon } = location.state || {};

  const { title, icon } =
    stateTitle && stateIcon
      ? { title: stateTitle, icon: stateIcon }
      : getTitleAndIcon(query, projects);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [tasksResponse, projectsResponse] = await Promise.all([
          fetch('/api/tasks' + location.search),
          fetch('/api/projects'),
        ]);

        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          setTasks(tasksData || []);
        } else {
          throw new Error('Failed to fetch tasks.');
        }

        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json();
          setProjects(projectsData?.projects || []);
        } else {
          throw new Error('Failed to fetch projects.');
        }
      } catch (error) {
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [location]);

  const handleTaskCreate = async (taskData: Partial<Task>) => {
    try {
      const response = await fetch('/api/task/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      if (response.ok) {
        const newTask = await response.json();
        setTasks((prevTasks) => [newTask, ...prevTasks]);
      } else {
        const errorData = await response.json();
        console.error('Failed to create task:', errorData.error);
        setError('Failed to create task.');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      setError('Error creating task.');
    }
  };

  const handleTaskUpdate = async (updatedTask: Task) => {
    try {
      const response = await fetch(`/api/task/${updatedTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask),
      });

      if (response.ok) {
        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.id === updatedTask.id ? updatedTask : task
          )
        );
      }
    } catch (error) {
      console.error('Error updating task:', error);
      setError('Error updating task.');
    }
  };

  const handleTaskDelete = async (taskId: number) => {
    try {
      const response = await fetch(`/api/task/${taskId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
      } else {
        const errorData = await response.json();
        console.error('Failed to delete task:', errorData.error);
        setError('Failed to delete task.');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Error deleting task.');
    }
  };

  return (
    <div>
      {/* Title and Icon */}
      <div className="flex items-center mb-8">
        <i className={`bi ${icon} text-xl mr-2`}></i>
        <h2 className="text-2xl font-light">{title}</h2>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <>
          {/* New Task Form */}
          <NewTask
            onTaskCreate={(taskName: string) =>
              handleTaskCreate({ name: taskName, status: 'not_started' })
            }
          />

          {/* Task List */}
          {tasks.length > 0 ? (
            <TaskList
              tasks={tasks}
              onTaskCreate={handleTaskCreate}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              projects={projects}
            />
          ) : (
            <p className="text-gray-500 text-center mt-4">No tasks available.</p>
          )}
        </>
      )}
    </div>
  );
};

export default Tasks;
