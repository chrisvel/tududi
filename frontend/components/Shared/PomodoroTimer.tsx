import React, { useState, useEffect, useRef } from 'react';
import {
    PlayIcon,
    PauseIcon,
    ArrowPathIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface PomodoroTimerProps {
    className?: string;
}

const POMODORO_STORAGE_KEY = 'tududi_pomodoro_timer';
const DEFAULT_TIME = 25 * 60; // 25 minutes in seconds

interface PomodoroState {
    isActive: boolean;
    timeLeft: number;
    isRunning: boolean;
    startTime?: number;
}

const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ className = '' }) => {
    const { t } = useTranslation();
    const [isActive, setIsActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME);
    const [isRunning, setIsRunning] = useState(false);
    const [showCompletionMessage, setShowCompletionMessage] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Load state from localStorage on mount
    useEffect(() => {
        const savedState = localStorage.getItem(POMODORO_STORAGE_KEY);
        if (savedState) {
            try {
                const state: PomodoroState = JSON.parse(savedState);
                if (state.isActive) {
                    setIsActive(true);
                    setStartTime(state.startTime || null);

                    // If timer was running, calculate how much time has passed
                    if (state.isRunning && state.startTime) {
                        const elapsed = Math.floor(
                            (Date.now() - state.startTime) / 1000
                        );
                        const newTimeLeft = Math.max(0, DEFAULT_TIME - elapsed);

                        setTimeLeft(newTimeLeft);
                        if (newTimeLeft > 0) {
                            setIsRunning(true);
                        } else {
                            setIsRunning(false);
                            setShowCompletionMessage(true);
                        }
                    } else {
                        // Timer was paused, use the saved timeLeft
                        setTimeLeft(state.timeLeft);
                        setIsRunning(state.isRunning);
                    }
                }
            } catch (error) {
                console.error('Failed to load pomodoro state:', error);
            }
        }
    }, []);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        const state: PomodoroState = {
            isActive,
            timeLeft,
            isRunning,
            startTime: startTime || undefined,
        };
        localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(state));
    }, [isActive, timeLeft, isRunning, startTime]);

    useEffect(() => {
        if (isRunning && timeLeft > 0) {
            intervalRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        setIsRunning(false);
                        setShowCompletionMessage(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning, timeLeft]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleTomatoClick = () => {
        setIsActive(true);
        setTimeLeft(DEFAULT_TIME);
        setIsRunning(false);
        setStartTime(null);
    };

    const handlePlayPause = () => {
        if (!isRunning) {
            // Starting the timer - set start time based on current progress
            const elapsedTime = DEFAULT_TIME - timeLeft;
            setStartTime(Date.now() - elapsedTime * 1000);
        }
        setIsRunning(!isRunning);
    };

    const handleReset = () => {
        setIsRunning(false);
        setTimeLeft(DEFAULT_TIME);
        setStartTime(null);
        setShowCompletionMessage(false);
    };

    const handleClose = () => {
        setIsActive(false);
        setIsRunning(false);
        setTimeLeft(DEFAULT_TIME);
        setStartTime(null);
        setShowCompletionMessage(false);
        localStorage.removeItem(POMODORO_STORAGE_KEY);
    };

    // Tomato SVG Icon
    const TomatoIcon = () => (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="cursor-pointer hover:scale-110 transition-transform"
        >
            {/* Tomato body */}
            <path
                d="M12 22c-4.5 0-8-3-8-7 0-2 1-4 2-5.5C7 8 8.5 7 10 7c1 0 2 .5 2 .5s1-.5 2-.5c1.5 0 3 1 4 2.5 1 1.5 2 3.5 2 5.5 0 4-3.5 7-8 7z"
                fill="#e74c3c"
                stroke="#c0392b"
                strokeWidth="1"
            />
            {/* Tomato stem */}
            <path
                d="M10 7c0-1 .5-2 1-3 .5 1 1.5 2 1.5 3"
                fill="none"
                stroke="#27ae60"
                strokeWidth="2"
                strokeLinecap="round"
            />
            {/* Tomato leaf */}
            <path
                d="M11 4c-1 0-2 1-2 2"
                fill="none"
                stroke="#27ae60"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );

    if (!isActive) {
        return (
            <div
                className={`flex items-center ${className}`}
                onClick={handleTomatoClick}
            >
                <TomatoIcon />
            </div>
        );
    }

    return (
        <div className={`relative flex items-center space-x-2 ${className}`}>
            <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1">
                <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white">
                    {formatTime(timeLeft)}
                </span>

                <button
                    onClick={handlePlayPause}
                    className="flex items-center justify-center p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    aria-label={
                        isRunning ? t('pomodoro.pause') : t('pomodoro.play')
                    }
                >
                    {isRunning ? (
                        <PauseIcon className="h-3 w-3" />
                    ) : (
                        <PlayIcon className="h-3 w-3" />
                    )}
                </button>

                <button
                    onClick={handleReset}
                    className="flex items-center justify-center p-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                    aria-label={t('pomodoro.reset')}
                >
                    <ArrowPathIcon className="h-3 w-3" />
                </button>

                <button
                    onClick={handleClose}
                    className="flex items-center justify-center p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    aria-label={t('pomodoro.close')}
                >
                    <XMarkIcon className="h-3 w-3" />
                </button>
            </div>

            {/* Completion Message */}
            {showCompletionMessage && (
                <div className="absolute top-full mt-2 right-0 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-200 px-3 py-2 rounded-lg shadow-lg z-50 whitespace-nowrap">
                    <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm font-medium">
                            🍅 {t('pomodoro.complete')}
                        </span>
                    </div>
                    <p className="text-xs mb-3">
                        {t('pomodoro.completeMessage')}
                    </p>
                    <button
                        onClick={() => {
                            setShowCompletionMessage(false);
                            setIsActive(false);
                            setTimeLeft(DEFAULT_TIME);
                            setStartTime(null);
                            localStorage.removeItem(POMODORO_STORAGE_KEY);
                        }}
                        className="w-full text-xs px-3 py-1 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                    >
                        {t('pomodoro.done')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default PomodoroTimer;
