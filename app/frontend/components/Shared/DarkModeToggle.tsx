import React, { useEffect, useState } from 'react';

const DarkModeToggle: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  return (
    <button onClick={() => setDarkMode(!darkMode)}>
      <i className={`bi ${darkMode ? 'bi-sun' : 'bi-moon'}`}></i>
    </button>
  );
};

export default DarkModeToggle;
