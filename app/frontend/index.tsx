import React from "react";
import { createRoot } from "react-dom/client"; 
import { BrowserRouter } from "react-router-dom"; 
import App from "./App";
import { ToastProvider } from "./components/Shared/ToastContext";

const storedPreference = localStorage.getItem("isDarkMode");
const prefersDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
const isDarkMode = storedPreference
  ? storedPreference === "true"
  : prefersDarkMode;

if (isDarkMode) {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}

const container = document.getElementById("root");

if (container) {
  const root = createRoot(container); 
  root.render(
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  );
}
