import React from 'react';

interface SwitchProps {
  isChecked: boolean;
  onToggle: () => void;
}

const Switch: React.FC<SwitchProps> = ({ isChecked, onToggle }) => {
  return (
    <div
      className="flex items-center space-x-2"
    >
      <div
        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ${
          isChecked ? 'bg-blue-600' : 'bg-gray-300'
        }`}
        onClick={onToggle}
      >
        <div
          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
            isChecked ? 'translate-x-6' : ''
          }`}
        ></div>
      </div>
    </div>
  );
};

export default Switch;