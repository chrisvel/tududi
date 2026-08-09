import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import DailyAssistant from '../DailyAssistant';
import {
    fetchAIConfig,
    fetchCachedBrief,
    fetchDailyBrief,
} from '../../../utils/aiAssistantService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : _key,
    }),
}));

jest.mock('../../../utils/aiAssistantService', () => ({
    fetchAIConfig: jest.fn(),
    fetchCachedBrief: jest.fn(),
    fetchDailyBrief: jest.fn(),
}));

const mockedFetchAIConfig = fetchAIConfig as jest.Mock;
const mockedFetchCachedBrief = fetchCachedBrief as jest.Mock;
const mockedFetchDailyBrief = fetchDailyBrief as jest.Mock;

const renderWidget = () =>
    render(
        <MemoryRouter>
            <DailyAssistant />
        </MemoryRouter>
    );

describe('DailyAssistant', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does not auto-generate when the server has no API key', async () => {
        mockedFetchAIConfig.mockResolvedValue({
            api_key_set: false,
            base_url: null,
            model: 'gpt-4o-mini',
        });
        mockedFetchCachedBrief.mockResolvedValue(null);

        renderWidget();

        await waitFor(() =>
            expect(
                screen.getByText('AI is not configured on this server.')
            ).toBeInTheDocument()
        );
        expect(mockedFetchDailyBrief).not.toHaveBeenCalled();
        expect(screen.queryByText('Generate Brief')).not.toBeInTheDocument();
    });

    it('auto-generates when the server is configured and no brief is cached', async () => {
        mockedFetchAIConfig.mockResolvedValue({
            api_key_set: true,
            base_url: null,
            model: 'gpt-4o-mini',
        });
        mockedFetchCachedBrief.mockResolvedValue(null);
        mockedFetchDailyBrief.mockResolvedValue({
            focus: 'Ship the fix',
            priority_actions: [],
            watch_out: [],
            generated_at: new Date().toISOString(),
            model: 'gpt-4o-mini',
        });

        renderWidget();

        await waitFor(() =>
            expect(mockedFetchDailyBrief).toHaveBeenCalledTimes(1)
        );
        await waitFor(() =>
            expect(screen.getByText('Ship the fix')).toBeInTheDocument()
        );
    });

    it('still shows a cached brief when the key was removed', async () => {
        mockedFetchAIConfig.mockResolvedValue({
            api_key_set: false,
            base_url: null,
            model: 'gpt-4o-mini',
        });
        mockedFetchCachedBrief.mockResolvedValue({
            focus: 'Yesterday focus',
            priority_actions: [],
            watch_out: [],
            generated_at: new Date().toISOString(),
            model: 'gpt-4o-mini',
        });

        renderWidget();

        await waitFor(() =>
            expect(screen.getByText('Yesterday focus')).toBeInTheDocument()
        );
        expect(mockedFetchDailyBrief).not.toHaveBeenCalled();
    });
});
