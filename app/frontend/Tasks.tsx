import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TaskList from "./components/Task/TaskList";
import NewTask from "./NewTask";
import { Task } from "./entities/Task";
import { Project } from "./entities/Project";
import { getTitleAndIcon } from "./components/Task/getTitleAndIcon";
import { getDescription } from "./components/Task/getDescription";
import { TagIcon, XMarkIcon } from "@heroicons/react/24/solid"; // Import X icon for removing tag

// Helper function to capitalize the first letter of a string
const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [orderBy, setOrderBy] = useState<string>("due_date:asc"); // State for sorting
  const dropdownRef = useRef<HTMLDivElement>(null); // Reference to the dropdown

  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const { title: stateTitle, icon: stateIcon } = location.state || {};

  const { title, icon } =
    stateTitle && stateIcon
      ? { title: stateTitle, icon: stateIcon }
      : getTitleAndIcon(query, projects);

  // Extract tag from query params
  const tag = query.get("tag");

  // Load orderBy from localStorage or use default
  useEffect(() => {
    const savedOrderBy = localStorage.getItem("order_by") || "due_date:asc";
    setOrderBy(savedOrderBy);

    const params = new URLSearchParams(location.search);
    if (!params.get("order_by")) {
      params.set("order_by", savedOrderBy); // Set the default to URL if not present
      navigate({
        pathname: location.pathname,
        search: `?${params.toString()}`,
      });
    }
  }, [location, navigate]);

  // Close dropdown if clicking outside
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

  // Fetch data when location changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch tasks with the selected tag if present
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

  // Function to remove the tag from the URL
  const handleRemoveTag = () => {
    const params = new URLSearchParams(location.search);
    params.delete("tag"); // Remove tag from query params
    navigate({
      pathname: location.pathname,
      search: `?${params.toString()}`, // Update the URL without the tag parameter
    });
  };

  // Function to create a new task
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

  // Function to update an existing task
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

  // Function to delete a task
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

  // Handle sorting changes
  const handleSortChange = (order: string) => {
    setOrderBy(order);
    localStorage.setItem("order_by", order); // Save the selected order to localStorage
    const params = new URLSearchParams(location.search);
    params.set("order_by", order); // Update or add the order_by param
    navigate({
      pathname: location.pathname,
      search: `?${params.toString()}`,
    });
    setDropdownOpen(false); // Close dropdown on selection
  };

  // Get the description for the current task view
  const description = getDescription(query, projects);

  return (
    <div className="flex justify-center px-4">
      {" "}
      {/* Center the content with padding */}
      <div className="w-full max-w-4xl">
        {" "}
        {/* Limit the width to 3xl (48rem) */}
        {/* Title and Icon */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <i className={`bi ${icon} text-xl mr-2`}></i>
            <h2 className="text-2xl font-light">
              {title}
            </h2>

            {/* If tag exists, display it as a styled button with an X to remove */}
            {tag && (
              <div className="ml-4 flex items-center space-x-2">
                <button
                  className="flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                  onClick={handleRemoveTag}
                >
                  <TagIcon className="h-4 w-4 text-gray-500 dark:text-gray-300" />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{capitalize(tag)}</span>
                  <XMarkIcon className="h-4 w-4 text-gray-500 dark:text-gray-300 hover:text-red-500" />
                </button>
              </div>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="relative inline-block text-left" ref={dropdownRef}>
            <div>
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
                <svg
                  className="-mr-1 ml-2 h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.292 7.707a1 1 0 011.414 0L10 11.414l3.293-3.707a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

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