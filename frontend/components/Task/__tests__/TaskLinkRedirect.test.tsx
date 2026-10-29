import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaskLinkRedirect from '../TaskLinkRedirect';
import { useTaskPanel } from '../../../store/taskPanelStore';

describe('TaskLinkRedirect', () => {
    it('sends a task link to all tasks with the task open in the side panel', () => {
        render(
            <MemoryRouter initialEntries={['/task/9cjdvfzyhxq9b6v']}>
                <Routes>
                    <Route path="/task/:uid" element={<TaskLinkRedirect />} />
                    <Route path="/tasks" element={<div>All tasks</div>} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText('All tasks')).toBeInTheDocument();
        expect(useTaskPanel.getState().uid).toBe('9cjdvfzyhxq9b6v');
    });
});
