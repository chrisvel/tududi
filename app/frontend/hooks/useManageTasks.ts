// hooks/useManageTasks.ts
import { useState } from 'react';
import { Task } from '../entities/Task';

const useManageTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  const fetchTasks = async (query: string = '') => {
    setIsLoading(true);
    setIsError(false);
    try {
      const response = await fetch(`/api/tasks${query}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      } else {
        throw new Error('Failed to fetch tasks.');
      }
    } catch (error) {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const createTask = async (taskData: Partial<Task>) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      if (response.ok) {
        const newTask = await response.json();
        setTasks((prevTasks) => [newTask, ...prevTasks]);
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const updateTask = async (taskId: number, taskData: Partial<Task>) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      if (response.ok) {
        setTasks((prevTasks) =>
          prevTasks.map((task) => (task.id === taskId ? { ...task, ...taskData } : task))
        );
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (taskId: number) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  return { tasks, isLoading, isError, fetchTasks, createTask, updateTask, deleteTask };
};

export default useManageTasks;
