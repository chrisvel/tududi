import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import ProjectItem from '../ProjectItem';
import { Project } from '../../../entities/Project';
import { listShares } from '../../../utils/sharesService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string'
                ? fallback
                : (fallback?.defaultValue ?? key),
    }),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({ showErrorToast: jest.fn() }),
}));

jest.mock('../../../utils/sharesService', () => ({
    listShares: jest.fn(),
}));

const renderCard = (project: Project) =>
    render(
        <MemoryRouter>
            <ProjectItem
                project={project}
                viewMode="cards"
                getCompletionPercentage={() => 0}
                activeDropdown={null}
                setActiveDropdown={jest.fn()}
                handleEditProject={jest.fn()}
                setProjectToDelete={jest.fn()}
                setIsConfirmDialogOpen={jest.fn()}
                onOpenShare={jest.fn()}
                onStatusChange={jest.fn()}
            />
        </MemoryRouter>
    );

describe('ProjectItem shares', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (listShares as jest.Mock).mockResolvedValue([]);
    });

    it('does not ask for the shares of a project the viewer cannot manage', async () => {
        renderCard({
            uid: 'member-only',
            name: 'Not mine',
            is_shared: true,
            can_share: false,
        });

        expect(await screen.findByText('Not mine')).toBeInTheDocument();
        expect(listShares).not.toHaveBeenCalled();
    });

    it('asks for the shares when the viewer may manage them', async () => {
        renderCard({
            uid: 'mine',
            name: 'Mine',
            is_shared: true,
            can_share: true,
        });

        await waitFor(() =>
            expect(listShares).toHaveBeenCalledWith('project', 'mine')
        );
    });
});
