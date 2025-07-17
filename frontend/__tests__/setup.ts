import '@testing-library/jest-dom';

// Mock i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue || key,
        i18n: {
            changeLanguage: () => new Promise(() => {}),
            language: 'en',
        },
    }),
}));

// Mock Zustand store
jest.mock('@/store/taskStore', () => ({
    useTaskStore: () => ({
        tasks: [],
        loading: false,
        error: null,
        fetchTasks: jest.fn(),
        updateTask: jest.fn(),
        createTask: jest.fn(),
        deleteTask: jest.fn(),
        toggleTaskCompletion: jest.fn(),
    }),
}));

// Mock SWR
jest.mock('swr', () => ({
    __esModule: true,
    default: () => ({
        data: undefined,
        error: undefined,
        isLoading: false,
        mutate: jest.fn(),
    }),
}));

// Mock tasksService
jest.mock('@/utils/tasksService', () => ({
    fetchTasks: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    toggleTaskCompletion: jest.fn(),
    fetchTaskById: jest.fn(),
    fetchSubtasks: jest.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}));

// Suppress console.error for cleaner test output
const originalError = console.error;
beforeAll(() => {
    console.error = (...args: any[]) => {
        if (
            typeof args[0] === 'string' &&
            args[0].includes('Warning: ReactDOM.render is no longer supported')
        ) {
            return;
        }
        originalError.call(console, ...args);
    };
});

afterAll(() => {
    console.error = originalError;
});