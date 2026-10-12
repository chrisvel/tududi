import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlanningAssistant from '../PlanningAssistant';
import * as api from '../../../utils/ltdAiService';
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('swr', () => ({
    __esModule: true,
    default: () => ({
        data: { tasks: [{ uid: 't1', title: 'A task' }], goals: [] },
    }),
}));
jest.mock('../../../utils/planningService', () => ({
    refreshPlanning: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../utils/ltdAiService', () => ({
    features: ['tomorrow', 'why', 'review'],
    previewAi: jest.fn(),
    runAi: jest.fn(),
    saveAiReview: jest.fn(),
    aiTargets: jest.fn(),
}));
const preview = {
    digest: 'approved',
    manifest: {
        provider: 'FakeProvider',
        model: 'fixture',
        destination: 'offline',
        token_upper_bound: 100,
        snapshot: { goals: [], tasks: [] },
    },
};
beforeEach(() => {
    jest.clearAllMocks();
    (api.previewAi as jest.Mock).mockResolvedValue(preview);
    (api.runAi as jest.Mock).mockResolvedValue({
        run_id: 1,
        proposal: null,
        text: { summary: 'A reflection', question: 'What next?' },
    });
    (api.saveAiReview as jest.Mock).mockResolvedValue({});
});
it('starts off, previews without generation and clears consent when the feature changes', async () => {
    render(
        <PlanningAssistant onChanged={jest.fn().mockResolvedValue(undefined)} />
    );
    expect(api.runAi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('ltdAi.preview'));
    await screen.findByText('ltdAi.manifest');
    expect(screen.getByText('ltdAi.generate')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('ltdAi.consent'));
    expect(screen.getByText('ltdAi.generate')).toBeEnabled();
    fireEvent.change(screen.getByLabelText('ltdAi.feature'), {
        target: { value: 'review' },
    });
    expect(screen.queryByText('ltdAi.generate')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('ltdAi.preview'));
    await screen.findByText('ltdAi.manifest');
    expect(screen.getByText('ltdAi.generate')).toBeDisabled();
    expect(api.runAi).not.toHaveBeenCalled();
});
it('requires explicit consent to generate and another click to save a review', async () => {
    const { container } = render(
        <PlanningAssistant onChanged={jest.fn().mockResolvedValue(undefined)} />
    );
    fireEvent.change(screen.getByLabelText('ltdAi.feature'), {
        target: { value: 'review' },
    });
    fireEvent.click(screen.getByText('ltdAi.preview'));
    await screen.findByText('ltdAi.manifest');
    fireEvent.click(screen.getByLabelText('ltdAi.consent'));
    fireEvent.click(screen.getByText('ltdAi.generate'));
    await screen.findByText('A reflection');
    expect(api.runAi).toHaveBeenCalledWith(
        expect.objectContaining({
            feature: 'review',
            allow_notes: false,
            allow_calendar_titles: false,
        }),
        'approved'
    );
    expect(api.saveAiReview).not.toHaveBeenCalled();
    expect(screen.getByLabelText('ltdAi.consent')).not.toBeChecked();
    expect(container.querySelector('bdi')?.textContent).toBe('FakeProvider');
    fireEvent.click(screen.getByText('ltdAi.saveReview'));
    await waitFor(() => expect(api.saveAiReview).toHaveBeenCalledTimes(1));
    await screen.findByText('ltdAi.saved');
});
