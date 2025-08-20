import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../../stores/adminStore';

const GlobalKeyboardHandler: React.FC = () => {
    const navigate = useNavigate();
    const { isAdminMode, toggleAdminMode } = useAdminStore();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Admin toggle: Ctrl + Shift + ] (check multiple possible values)
            if (
                event.ctrlKey &&
                event.shiftKey &&
                (event.key === ']' || event.code === 'BracketRight')
            ) {
                event.preventDefault();
                toggleAdminMode();
                return;
            }

            // Navigate to admin if admin mode is enabled and user presses Ctrl + Shift + R
            if (
                event.ctrlKey &&
                event.shiftKey &&
                event.key.toLowerCase() === 'r' &&
                isAdminMode
            ) {
                event.preventDefault();
                navigate('/admin');
                return;
            }
        };

        document.addEventListener('keydown', handleKeyDown, true); // Use capture phase

        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [isAdminMode, toggleAdminMode, navigate]);

    return null; // This component only handles keyboard shortcuts
};

export default GlobalKeyboardHandler;
