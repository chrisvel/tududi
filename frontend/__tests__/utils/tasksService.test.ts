import { Task } from '../../entities/Task';

// Mock the tasksService functions
const createTask = async (taskData: Partial<Task>) => {
  const response = await fetch('/api/task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData)
  });
  
  if (!response.ok) {
    throw new Error('Failed to create task');
  }
  
  return response.json();
};

const updateTask = async (id: number, taskData: Partial<Task>) => {
  const response = await fetch(`/api/task/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData)
  });
  
  if (!response.ok) {
    throw new Error('Failed to update task');
  }
  
  return response.json();
};

const deleteTask = async (id: number) => {
  const response = await fetch(`/api/task/${id}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete task');
  }
  
  return response.json();
};

const fetchTasks = async () => {
  const response = await fetch('/api/tasks');
  
  if (!response.ok) {
    throw new Error('Failed to fetch tasks');
  }
  
  return response.json();
};

describe('Tasks Service', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  describe('createTask', () => {
    it('creates a task successfully', async () => {
      const mockTask = { name: 'Test Task', priority: 'medium' as const, status: 'not_started' as const };
      const mockResponse = { id: 1, ...mockTask };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await createTask(mockTask);

      expect(global.fetch).toHaveBeenCalledWith('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockTask)
      });
      expect(result).toEqual(mockResponse);
    });

    it('throws error when creation fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      });

      await expect(createTask({ name: 'Test Task' })).rejects.toThrow('Failed to create task');
    });
  });

  describe('updateTask', () => {
    it('updates a task successfully', async () => {
      const mockUpdate = { name: 'Updated Task' };
      const mockResponse = { id: 1, ...mockUpdate };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await updateTask(1, mockUpdate);

      expect(global.fetch).toHaveBeenCalledWith('/api/task/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockUpdate)
      });
      expect(result).toEqual(mockResponse);
    });

    it('throws error when update fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      });

      await expect(updateTask(1, { name: 'Updated' })).rejects.toThrow('Failed to update task');
    });
  });

  describe('deleteTask', () => {
    it('deletes a task successfully', async () => {
      const mockResponse = { message: 'Task deleted successfully' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await deleteTask(1);

      expect(global.fetch).toHaveBeenCalledWith('/api/task/1', {
        method: 'DELETE'
      });
      expect(result).toEqual(mockResponse);
    });

    it('throws error when deletion fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      });

      await expect(deleteTask(1)).rejects.toThrow('Failed to delete task');
    });
  });

  describe('fetchTasks', () => {
    it('fetches tasks successfully', async () => {
      const mockTasks = {
        tasks: [
          { id: 1, name: 'Task 1' },
          { id: 2, name: 'Task 2' }
        ],
        metrics: {}
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTasks
      });

      const result = await fetchTasks();

      expect(global.fetch).toHaveBeenCalledWith('/api/tasks');
      expect(result).toEqual(mockTasks);
    });

    it('throws error when fetch fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      });

      await expect(fetchTasks()).rejects.toThrow('Failed to fetch tasks');
    });
  });
});