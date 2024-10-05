import React from "react";
import { createRoot } from "react-dom/client"; // Import createRoot from react-dom
import { BrowserRouter } from "react-router-dom"; // Import BrowserRouter
import App from "./App";
import { ToastProvider } from "./components/Shared/ToastContext";

// Determine initial dark mode preference
const storedPreference = localStorage.getItem("isDarkMode");
const prefersDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
const isDarkMode = storedPreference
  ? storedPreference === "true"
  : prefersDarkMode;

// Add or remove the 'dark' class before rendering the app
if (isDarkMode) {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}

// Get the root DOM element
const container = document.getElementById("root");

// Ensure the root element exists before creating root
if (container) {
  const root = createRoot(container); // Use createRoot to create a root
  root.render(
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  );
}
