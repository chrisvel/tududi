import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TwoFactorCard from '../TwoFactorCard';
import * as mfaService from '../../../../utils/mfaService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string'
                ? fallback
                : (fallback?.defaultValue ?? key),
    }),
}));

jest.mock('../../../../utils/mfaService', () => ({
    ...jest.requireActual('../../../../utils/mfaService'),
    fetchMfaStatus: jest.fn(),
    startMfaSetup: jest.fn(),
    enableMfa: jest.fn(),
}));

jest.mock('../../../../utils/apiKeysService', () => ({
    fetchApiKeys: jest.fn().mockResolvedValue([]),
    revokeApiKey: jest.fn(),
}));

const mocked = mfaService as jest.Mocked<typeof mfaService>;

describe('TwoFactorCard', () => {
    beforeEach(() => {
        mocked.fetchMfaStatus.mockResolvedValue({
            enabled: false,
            enabled_at: null,
            recovery_codes_left: 0,
            available: true,
        });
        mocked.startMfaSetup.mockResolvedValue({
            secret: 'ABCDEFGH',
            otpauth_url: 'otpauth://totp/x',
            qr_svg: '<svg/>',
        });
        mocked.enableMfa.mockResolvedValue({
            recovery_codes: ['aaaaa-bbbbb'],
        });
    });

    // The profile page wraps every tab in its own <form>; confirming the
    // code must not submit (and reload) that form.
    it('confirms setup without submitting the surrounding profile form', async () => {
        const outerSubmit = jest.fn((e) => e.preventDefault());
        render(
            <form onSubmit={outerSubmit}>
                <TwoFactorCard />
            </form>
        );

        fireEvent.click(await screen.findByTestId('mfa-setup-start'));
        fireEvent.change(await screen.findByTestId('mfa-setup-code'), {
            target: { value: '123 456' },
        });
        fireEvent.click(screen.getByTestId('mfa-setup-confirm'));

        await waitFor(() =>
            expect(mocked.enableMfa).toHaveBeenCalledWith('123456')
        );
        expect(
            await screen.findByTestId('mfa-recovery-codes')
        ).toHaveTextContent('aaaaa-bbbbb');
        expect(outerSubmit).not.toHaveBeenCalled();
    });

    it('confirms with Enter in the code field', async () => {
        const outerSubmit = jest.fn((e) => e.preventDefault());
        render(
            <form onSubmit={outerSubmit}>
                <TwoFactorCard />
            </form>
        );

        fireEvent.click(await screen.findByTestId('mfa-setup-start'));
        const input = await screen.findByTestId('mfa-setup-code');
        fireEvent.change(input, { target: { value: '654321' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() =>
            expect(mocked.enableMfa).toHaveBeenCalledWith('654321')
        );
        expect(outerSubmit).not.toHaveBeenCalled();
    });
});
