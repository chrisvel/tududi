import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TaskList from "./Task/TaskList";
import NewTask from "./Task/NewTask";
import { Task } from "../entities/Task";
import { Project } from "../entities/Project";
import { getTitleAndIcon } from "./Task/getTitleAndIcon";
import { getDescription } from "./Task/getDescription";
import { TagIcon, XMarkIcon, ChevronDownIcon } from "@heroicons/react/24/solid";

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [orderBy, setOrderBy] = useState<string>("due_date:asc");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const { title: stateTitle, icon: stateIcon } = location.state || {};

  const { title, icon } =
    stateTitle && stateIcon
      ? { title: stateTitle, icon: stateIcon }
      : getTitleAndIcon(query, projects);

  const tag = query.get("tag");

  useEffect(() => {
    const savedOrderBy = localStorage.getItem("order_by") || "due_date:asc";
    setOrderBy(savedOrderBy);

    const params = new URLSearchParams(location.search);
    if (!params.get("order_by")) {
      params.set("order_by", savedOrderBy);
      navigate({
        pathname: location.pathname,
        search: `?${params.toString()}`,
      });
    }
  }, [location, navigate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const tagId = query.get("tag");
        const [tasksResponse, projectsResponse] = await Promise.all([
          fetch(`/api/tasks${location.search}${tagId ? `&tag=${tagId}` : ""}`),
          fetch("/api/projects"),
        ]);

        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          setTasks(tasksData || []);
        } else {
          throw new Error("Failed to fetch tasks.");
        }

        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json();
          setProjects(projectsData?.projects || []);
        } else {
          throw new Error("Failed to fetch projects.");
        }
      } catch (error) {
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [location]);

  const handleRemoveTag = () => {
    const params = new URLSearchParams(location.search);
    params.delete("tag");
    navigate({
      pathname: location.pathname,
      search: `?${params.toString()}`,
    });
  };

  const handleTaskCreate = async (taskData: Partial<Task>) => {
    try {
      const response = await fetch("/api/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });

      if (response.ok) {
        const newTask = await response.json();
        setTasks((prevTasks) => [newTask, ...prevTasks]);
      } else {
        const errorData = await response.json();
        console.error("Failed to create task:", errorData.error);
        setError("Failed to create task.");
      }
    } catch (error) {
      console.error("Error creating task:", error);
      setError("Error creating task.");
    }
  };

  const handleTaskUpdate = async (updatedTask: Task) => {
    try {
      const response = await fetch(`/api/task/${updatedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
      console.error("Error updating task:", error);
      setError("Error updating task.");
    }
  };

  const handleTaskDelete = async (taskId: number) => {
    try {
      const response = await fetch(`/api/task/${taskId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
      } else {
        const errorData = await response.json();
        console.error("Failed to delete task:", errorData.error);
        setError("Failed to delete task.");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      setError("Error deleting task.");
    }
  };

  const handleSortChange = (order: string) => {
    setOrderBy(order);
    localStorage.setItem("order_by", order);
    const params = new URLSearchParams(location.search);
    params.set("order_by", order);
    navigate({
      pathname: location.pathname,
      search: `?${params.toString()}`,
    });
    setDropdownOpen(false);
  };

  const description = getDescription(query, projects);

  return (
    <div className="flex justify-center px-4 lg:px-2">
      <div className="w-full max-w-5xl">
        {/* Title and Icon */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
          <div className="flex items-center mb-2 sm:mb-0">
            <i className={`bi ${icon} text-xl mr-2`}></i>
            <h2 className="text-2xl font-light">{title}</h2>

            {tag && (
              <div className="ml-4 flex items-center space-x-2">
                <button
                  className="flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                  onClick={handleRemoveTag}
                >
                  <TagIcon className="h-4 w-4 text-gray-500 dark:text-gray-300" />
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {capitalize(tag)}
                  </span>
                  <XMarkIcon className="h-4 w-4 text-gray-500 dark:text-gray-300 hover:text-red-500" />
                </button>
              </div>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
              type="button"
              className="inline-flex justify-center w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              id="menu-button"
              aria-expanded="true"
              aria-haspopup="true"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <i className="bi bi-sort-alpha-down me-2"></i>{" "}
              {capitalize(orderBy.split(":")[0].replace("_", " "))}
              <ChevronDownIcon className="h-5 w-5 ml-2 text-gray-500 dark:text-gray-300" />
            </button>

            {dropdownOpen && (
              <div
                className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="menu-button"
              >
                <div className="py-1" role="none">
                  {[
                    "due_date:asc",
                    "name:asc",
                    "priority:desc",
                    "status:desc",
                    "created_at:desc",
                  ].map((order) => (
                    <button
                      key={order}
                      onClick={() => handleSortChange(order)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                    >
                      {capitalize(order.split(":")[0].replace("_", " "))}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <>
            {/* New Task Form */}
            <NewTask
              onTaskCreate={(taskName: string) =>
                handleTaskCreate({ name: taskName, status: "not_started" })
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
              <p className="text-gray-500 text-center mt-4">
                No tasks available.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Tasks;

