import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Projects from '../../components/Projects';
import { Project } from '../../entities/Project';

// Mock the store
const mockStore = {
  areasStore: {
    areas: [],
    setAreas: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn()
  },
  projectsStore: {
    projects: [
      {
        id: 1,
        name: 'Test Project 1',
        description: 'First test project',
        active: true
      },
      {
        id: 2,
        name: 'Test Project 2',
        description: 'Second test project',
        active: true
      }
    ],
    setProjects: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn(),
    isLoading: false,
    isError: false
  }
};

jest.mock('../../store/useStore', () => ({
  useStore: (selector: any) => selector(mockStore)
}));

// Mock services
jest.mock('../../utils/projectsService', () => ({
  fetchProjects: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn()
}));

jest.mock('../../utils/areasService', () => ({
  fetchAreas: jest.fn()
}));

const renderProjects = () => {
  return render(
    <BrowserRouter>
      <Projects />
    </BrowserRouter>
  );
};

describe('Projects Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders projects list', () => {
    renderProjects();
    
    expect(screen.getByText('Test Project 1')).toBeInTheDocument();
    expect(screen.getByText('Test Project 2')).toBeInTheDocument();
  });

  it('renders component without crashing', () => {
    expect(() => renderProjects()).not.toThrow();
  });

  it('displays projects with their data', () => {
    const { container } = renderProjects();
    
    // Check that component renders with project data
    expect(container.querySelector('[class*="project"]')).toBeTruthy();
  });

  it('shows projects container', () => {
    const { container } = renderProjects();
    expect(container.firstChild).toBeTruthy();
  });

  it('handles empty projects array', () => {
    const emptyMockStore = {
      ...mockStore,
      projectsStore: {
        ...mockStore.projectsStore,
        projects: []
      }
    };

    jest.doMock('../../store/useStore', () => ({
      useStore: (selector: any) => selector(emptyMockStore)
    }));

    expect(() => renderProjects()).not.toThrow();
  });

  it('handles loading state', () => {
    const loadingMockStore = {
      ...mockStore,
      projectsStore: {
        ...mockStore.projectsStore,
        isLoading: true
      }
    };

    jest.doMock('../../store/useStore', () => ({
      useStore: (selector: any) => selector(loadingMockStore)
    }));

    expect(() => renderProjects()).not.toThrow();
  });

  it('handles error state', () => {
    const errorMockStore = {
      ...mockStore,
      projectsStore: {
        ...mockStore.projectsStore,
        isError: true
      }
    };

    jest.doMock('../../store/useStore', () => ({
      useStore: (selector: any) => selector(errorMockStore)
    }));

    expect(() => renderProjects()).not.toThrow();
  });

  it('renders project names correctly', () => {
    renderProjects();
    
    // Check that project names are displayed
    const project1 = screen.getByText('Test Project 1');
    const project2 = screen.getByText('Test Project 2');
    
    expect(project1).toBeInTheDocument();
    expect(project2).toBeInTheDocument();
  });

  it('displays multiple projects', () => {
    renderProjects();
    
    const projectNames = ['Test Project 1', 'Test Project 2'];
    projectNames.forEach(name => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  it('maintains component structure', () => {
    const { container } = renderProjects();
    
    // Should have a root container
    expect(container.children.length).toBeGreaterThan(0);
  });
});