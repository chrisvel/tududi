import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Navbar from '../../components/Navbar';

const mockUser: {
  email: string;
  avatarUrl?: string;
} = {
  email: 'test@example.com',
  avatarUrl: 'https://example.com/avatar.jpg'
};

const defaultProps = {
  isDarkMode: false,
  toggleDarkMode: jest.fn(),
  currentUser: mockUser,
  setCurrentUser: jest.fn(),
  isSidebarOpen: false,
  setIsSidebarOpen: jest.fn()
};

const renderNavbar = (props = defaultProps) => {
  return render(
    <BrowserRouter>
      <Navbar {...props} />
    </BrowserRouter>
  );
};

// Mock logout API call
global.fetch = jest.fn();

describe('Navbar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });

  it('renders navbar with user email', () => {
    renderNavbar();
    
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders dark mode toggle button', () => {
    renderNavbar();
    
    const darkModeButton = screen.getByRole('button', { name: /toggle dark mode/i });
    expect(darkModeButton).toBeInTheDocument();
  });

  it('calls toggleDarkMode when dark mode button is clicked', async () => {
    const user = userEvent.setup();
    const mockToggleDarkMode = jest.fn();
    
    renderNavbar({
      ...defaultProps,
      toggleDarkMode: mockToggleDarkMode
    });
    
    const darkModeButton = screen.getByRole('button', { name: /toggle dark mode/i });
    
    await act(async () => {
      await user.click(darkModeButton);
    });
    
    expect(mockToggleDarkMode).toHaveBeenCalled();
  });

  it('renders sidebar toggle button', () => {
    renderNavbar();
    
    const sidebarButton = screen.getByRole('button', { name: /toggle sidebar/i });
    expect(sidebarButton).toBeInTheDocument();
  });

  it('calls setIsSidebarOpen when sidebar button is clicked', async () => {
    const user = userEvent.setup();
    const mockSetIsSidebarOpen = jest.fn();
    
    renderNavbar({
      ...defaultProps,
      setIsSidebarOpen: mockSetIsSidebarOpen
    });
    
    const sidebarButton = screen.getByRole('button', { name: /toggle sidebar/i });
    
    await act(async () => {
      await user.click(sidebarButton);
    });
    
    expect(mockSetIsSidebarOpen).toHaveBeenCalledWith(true);
  });

  it('opens user dropdown when user icon is clicked', async () => {
    const user = userEvent.setup();
    renderNavbar();
    
    const userButton = screen.getByRole('button', { name: /user menu/i });
    
    await act(async () => {
      await user.click(userButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/profile/i)).toBeInTheDocument();
      expect(screen.getByText(/logout/i)).toBeInTheDocument();
    });
  });

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    renderNavbar();
    
    const userButton = screen.getByRole('button', { name: /user menu/i });
    
    await act(async () => {
      await user.click(userButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/logout/i)).toBeInTheDocument();
    });
    
    // Click outside the dropdown
    await act(async () => {
      await user.click(document.body);
    });
    
    await waitFor(() => {
      expect(screen.queryByText(/logout/i)).not.toBeInTheDocument();
    });
  });

  it('handles logout when logout button is clicked', async () => {
    const user = userEvent.setup();
    const mockSetCurrentUser = jest.fn();
    
    renderNavbar({
      ...defaultProps,
      setCurrentUser: mockSetCurrentUser
    });
    
    const userButton = screen.getByRole('button', { name: /user menu/i });
    
    await act(async () => {
      await user.click(userButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/logout/i)).toBeInTheDocument();
    });
    
    const logoutButton = screen.getByText(/logout/i);
    
    await act(async () => {
      await user.click(logoutButton);
    });
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
    });
  });

  it('renders tududi brand link', () => {
    renderNavbar();
    
    const brandLink = screen.getByRole('link', { name: /tududi/i });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute('href', '/');
  });

  it('displays correct dark mode icon based on current mode', () => {
    // Test light mode (should show moon icon)
    const { rerender } = renderNavbar({
      ...defaultProps,
      isDarkMode: false
    });
    
    expect(screen.getByRole('button', { name: /toggle dark mode/i })).toBeInTheDocument();
    
    // Test dark mode (should show sun icon)
    rerender(
      <BrowserRouter>
        <Navbar {...defaultProps} isDarkMode={true} />
      </BrowserRouter>
    );
    
    expect(screen.getByRole('button', { name: /toggle dark mode/i })).toBeInTheDocument();
  });

  it('handles user without avatar', () => {
    const userWithoutAvatar = {
      email: 'test@example.com',
      avatarUrl: undefined
    };
    
    renderNavbar({
      ...defaultProps,
      currentUser: userWithoutAvatar
    });
    
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('shows sidebar as open when isSidebarOpen is true', () => {
    renderNavbar({
      ...defaultProps,
      isSidebarOpen: true
    });
    
    const sidebarButton = screen.getByRole('button', { name: /toggle sidebar/i });
    expect(sidebarButton).toBeInTheDocument();
  });

  it('handles logout error gracefully', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    
    renderNavbar();
    
    const userButton = screen.getByRole('button', { name: /user menu/i });
    
    await act(async () => {
      await user.click(userButton);
    });
    
    const logoutButton = screen.getByText(/logout/i);
    
    await act(async () => {
      await user.click(logoutButton);
    });
    
    // Should still attempt logout despite error
    expect(global.fetch).toHaveBeenCalled();
  });

  it('navigates to profile when profile link is clicked', async () => {
    const user = userEvent.setup();
    renderNavbar();
    
    const userButton = screen.getByRole('button', { name: /user menu/i });
    
    await act(async () => {
      await user.click(userButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/profile/i)).toBeInTheDocument();
    });
    
    const profileLink = screen.getByText(/profile/i);
    expect(profileLink.closest('a')).toHaveAttribute('href', '/profile');
  });

  it('maintains dropdown state correctly', async () => {
    const user = userEvent.setup();
    renderNavbar();
    
    const userButton = screen.getByRole('button', { name: /user menu/i });
    
    // Open dropdown
    await act(async () => {
      await user.click(userButton);
    });
    
    expect(screen.getByText(/logout/i)).toBeInTheDocument();
    
    // Close dropdown by clicking button again
    await act(async () => {
      await user.click(userButton);
    });
    
    await waitFor(() => {
      expect(screen.queryByText(/logout/i)).not.toBeInTheDocument();
    });
  });
});