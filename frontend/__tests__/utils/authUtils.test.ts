import { User } from '../../entities/User';

// Mock authentication utilities
const login = async (email: string, password: string) => {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Login failed');
  }
  
  return response.json();
};

const logout = async () => {
  const response = await fetch('/api/logout', {
    method: 'POST',
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error('Logout failed');
  }
  
  return response.json();
};

const getCurrentUser = async (): Promise<User | null> => {
  try {
    const response = await fetch('/api/user', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      return null;
    }
    
    return response.json();
  } catch {
    return null;
  }
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string): boolean => {
  return password.length >= 8;
};

const isAuthenticated = (user: User | null): boolean => {
  return user !== null && user.email !== undefined;
};

describe('Authentication Utils', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  describe('login', () => {
    it('successfully logs in with valid credentials', async () => {
      const mockResponse = {
        success: true,
        user: { id: 1, email: 'test@example.com' }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await login('test@example.com', 'password123');

      expect(global.fetch).toHaveBeenCalledWith('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123'
        })
      });

      expect(result).toEqual(mockResponse);
    });

    it('throws error on invalid credentials', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid credentials' })
      });

      await expect(login('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });

    it('throws error on network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(login('test@example.com', 'password123'))
        .rejects.toThrow('Network error');
    });

    it('handles server error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({})
      });

      await expect(login('test@example.com', 'password123'))
        .rejects.toThrow('Login failed');
    });
  });

  describe('logout', () => {
    it('successfully logs out', async () => {
      const mockResponse = { success: true };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await logout();

      expect(global.fetch).toHaveBeenCalledWith('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });

      expect(result).toEqual(mockResponse);
    });

    it('throws error on logout failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      });

      await expect(logout()).rejects.toThrow('Logout failed');
    });

    it('handles network error during logout', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(logout()).rejects.toThrow('Network error');
    });
  });

  describe('getCurrentUser', () => {
    it('returns user when authenticated', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      });

      const result = await getCurrentUser();

      expect(global.fetch).toHaveBeenCalledWith('/api/user', {
        credentials: 'include'
      });

      expect(result).toEqual(mockUser);
    });

    it('returns null when not authenticated', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      });

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('validateEmail', () => {
    it('validates correct email formats', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('test+tag@example.org')).toBe(true);
    });

    it('rejects invalid email formats', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('test.example.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('validates passwords with minimum length', () => {
      expect(validatePassword('password123')).toBe(true);
      expect(validatePassword('12345678')).toBe(true);
      expect(validatePassword('very-long-password')).toBe(true);
    });

    it('rejects passwords below minimum length', () => {
      expect(validatePassword('1234567')).toBe(false);
      expect(validatePassword('short')).toBe(false);
      expect(validatePassword('')).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('returns true for valid user', () => {
      const user: User = { 
        id: 1, 
        email: 'test@example.com',
        language: 'en',
        appearance: 'light',
        timezone: 'UTC'
      };
      expect(isAuthenticated(user)).toBe(true);
    });

    it('returns false for null user', () => {
      expect(isAuthenticated(null)).toBe(false);
    });

    it('returns false for user without email', () => {
      const invalidUser = { 
        id: 1,
        language: 'en',
        appearance: 'light',
        timezone: 'UTC'
      } as User;
      expect(isAuthenticated(invalidUser)).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('handles complete login flow', async () => {
      // Mock successful login
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, user: { id: 1, email: 'test@example.com' } })
        })
        // Mock getting current user
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1, email: 'test@example.com' })
        });

      // Login
      const loginResult = await login('test@example.com', 'password123');
      expect(loginResult.success).toBe(true);

      // Get current user
      const currentUser = await getCurrentUser();
      expect(currentUser).toEqual({ id: 1, email: 'test@example.com' });

      // Check authentication status
      expect(isAuthenticated(currentUser)).toBe(true);
    });

    it('handles complete logout flow', async () => {
      // Mock successful logout
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })
        // Mock user no longer authenticated
        .mockResolvedValueOnce({
          ok: false
        });

      // Logout
      const logoutResult = await logout();
      expect(logoutResult.success).toBe(true);

      // Get current user (should be null)
      const currentUser = await getCurrentUser();
      expect(currentUser).toBeNull();

      // Check authentication status
      expect(isAuthenticated(currentUser)).toBe(false);
    });

    it('validates user input before authentication', () => {
      // Valid inputs
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validatePassword('securepassword')).toBe(true);

      // Invalid inputs
      expect(validateEmail('invalid')).toBe(false);
      expect(validatePassword('short')).toBe(false);
    });
  });
});