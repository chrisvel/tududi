import '@testing-library/jest-dom';

// Mock SWR to avoid network requests in tests
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: jest.fn()
  })),
  mutate: jest.fn()
}));

// Mock React Router
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/' }),
  useParams: () => ({})
}));

// Mock Zustand store
jest.mock('../store/useStore', () => ({
  __esModule: true,
  default: () => ({
    user: null,
    login: jest.fn(),
    logout: jest.fn(),
    isAuthenticated: false,
    darkMode: false,
    toggleDarkMode: jest.fn()
  })
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: jest.fn()
    }
  })
}));

// Mock ToastContext
jest.mock('../components/Shared/ToastContext', () => ({
  useToast: () => ({
    showToast: jest.fn(),
    showSuccessToast: jest.fn(),
    showErrorToast: jest.fn()
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children
}));

// Global test utilities
global.fetch = jest.fn();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// This file is a setup file, not a test file
// No tests should be defined here