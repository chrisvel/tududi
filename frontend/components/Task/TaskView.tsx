import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Task } from "../../entities/Task";
import { Project } from "../../entities/Project";
import TaskModal from "./TaskModal";
import { fetchTaskByUuid, updateTask, deleteTask } from "../../utils/tasksService";
import { createProject } from "../../utils/projectsService";
import { useStore } from "../../store/useStore";

const TaskView: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const store = useStore();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTask = async () => {
      if (!uuid) {
        setError("No task UUID provided");
        setLoading(false);
        return;
      }

      try {
        const taskData = await fetchTaskByUuid(uuid);
        setTask(taskData);
      } catch (err) {
        setError("An error occurred while fetching the task");
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [uuid]);

  const handleClose = () => {
    navigate(-1); // Go back to previous page
  };

  const handleTaskUpdate = async (updatedTask: Task) => {
    try {
      if (task?.id) {
        const updated = await updateTask(task.id, updatedTask);
        setTask(updated);
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleTaskDelete = async (taskId: number) => {
    try {
      await deleteTask(taskId);
      navigate('/today'); // Navigate back to today view after deletion
    } catch (error) {
      console.error("Error deleting task:", error);
      throw error;
    }
  };

  const handleCreateProject = async (name: string): Promise<Project> => {
    try {
      return await createProject({ name });
    } catch (error) {
      console.error("Error creating project:", error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading task...
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
            {error || "Task not found"}
          </div>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <TaskModal
      isOpen={true}
      task={task}
      onClose={handleClose}
      onSave={handleTaskUpdate}
      onDelete={handleTaskDelete}
      projects={store.projectsStore.projects}
      onCreateProject={handleCreateProject}
    />
  );
};

export default TaskView;