import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TaskList from "./Task/TaskList";
import NewTask from "./Task/NewTask";
import { Task } from "../entities/Task";
import { Project } from "../entities/Project";
import { getTitleAndIcon } from "./Task/getTitleAndIcon";
import { getDescription } from "./Task/getDescription";
import { createTask } from "../utils/tasksService";
import {
  TagIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronDoubleDownIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

// Helper function to get search placeholder by language
const getSearchPlaceholder = (language: string): string => {
  const placeholders: Record<string, string> = {
    en: 'Search tasks...',
    el: 'Αναζήτηση εργασιών...',
    es: 'Buscar tareas...',
    de: 'Aufgaben suchen...',
    jp: 'タスクを検索...',
    ua: 'Пошук завдань...'
  };
  
  return placeholders[language] || 'Search tasks...';
};

const Tasks: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [orderBy, setOrderBy] = useState<string>("due_date:asc");
  const [taskSearchQuery, setTaskSearchQuery] = useState<string>("");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const { title: stateTitle, icon: stateIcon } = location.state || {};

  const { title, icon } =
    stateTitle && stateIcon
      ? { title: stateTitle, icon: stateIcon }
      : getTitleAndIcon(query, projects, t);

  const IconComponent =
    typeof icon === "string" ? React.createElement(icon) : icon;

  const tag = query.get("tag");
  const status = query.get("status");

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
          setTasks(tasksData.tasks || []);
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
      const newTask = await createTask(taskData as Task);
      // Add the new task optimistically to avoid race conditions
      setTasks((prevTasks) => [newTask, ...prevTasks]);
    } catch (error) {
      console.error("Error creating task:", error);
      setError("Error creating task.");
      throw error; // Re-throw to allow proper error handling
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
      } else {
        const errorData = await response.json();
        console.error("Failed to update task:", errorData.error);
        setError("Failed to update task.");
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

  const description = getDescription(query, projects, t);

  const isNewTaskAllowed = () => {
    return status !== "done";
  };

  const filteredTasks = tasks.filter((task) =>
    task.name.toLowerCase().includes(taskSearchQuery.toLowerCase())
  );

  return (
    <div className="flex justify-center px-4 lg:px-2">
      <div className="w-full max-w-5xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
          <div className="flex items-center mb-2 sm:mb-0">
            {IconComponent && <IconComponent className="h-6 w-6 mr-2" />}
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

          <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
              type="button"
              className="inline-flex justify-center w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
              id="menu-button"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <ChevronDoubleDownIcon className="h-5 w-5 text-gray-500 mr-2" />{" "}
              {t(`sort.${orderBy.split(":")[0]}`, capitalize(orderBy.split(":")[0].replace("_", " ")))}
              <ChevronDownIcon className="h-5 w-5 ml-2 text-gray-500 dark:text-gray-300" />
            </button>

            {dropdownOpen && (
              <div
                className="origin-top-right absolute left-0 sm:right-0 sm:left-auto mt-2 w-full sm:w-56 max-w-full rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="menu-button"
              >
                <div className="py-1 max-h-60 overflow-y-auto" role="none">
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
                      role="menuitem"
                    >
                      {t(`sort.${order.split(":")[0]}`, capitalize(order.split(":")[0].replace("_", " ")))}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>


        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
        
        <div className="mb-4">
          <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm p-2">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
            <input
              type="text"
              placeholder={getSearchPlaceholder(i18n.language)}
              value={taskSearchQuery}
              onChange={(e) => setTaskSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white"
            />
          </div>
        </div>
        {loading ? (
          <p>{t('common.loading', 'Loading...')}</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <>
            {/* New Task Form */}
            {isNewTaskAllowed() && (
              <NewTask
                onTaskCreate={async (taskName: string) =>
                  await handleTaskCreate({ name: taskName, status: "not_started" })
                }
              />
            )}

            {filteredTasks.length > 0 ? (
              <TaskList
                tasks={filteredTasks}
                onTaskCreate={handleTaskCreate}
                onTaskUpdate={handleTaskUpdate}
                onTaskDelete={handleTaskDelete}
                projects={projects}
              />
            ) : (
              <p className="text-gray-500 text-center mt-4">
                {t('tasks.noTasksAvailable', 'Δεν υπάρχουν διαθέσιμες εργασίες.')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Tasks;