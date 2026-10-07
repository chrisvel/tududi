import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import OIDCProviderButtons from '../OIDCProviderButtons';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any, options?: any) => {
            const text = typeof fallback === 'string' ? fallback : key;
            const values = options || {};
            return text.replace(/{{(\w+)}}/g, (_m, name) =>
                String(values[name] ?? '')
            );
        },
    }),
}));

const google = { slug: 'google', name: 'Google' };
const okta = { slug: 'okta', name: 'Company SSO' };

describe('OIDCProviderButtons', () => {
    it('renders nothing without providers', () => {
        const { container } = render(<OIDCProviderButtons providers={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('signs in by default, with the Google mark on Google only', () => {
        render(<OIDCProviderButtons providers={[google, okta]} />);
        expect(screen.getByTestId('oidc-google')).toHaveTextContent(
            'Sign in with Google'
        );
        expect(screen.getByTestId('oidc-okta')).toHaveTextContent(
            'Sign in with Company SSO'
        );
        expect(screen.getAllByTestId('oidc-google-mark')).toHaveLength(1);
    });

    it('says sign up on the register page', () => {
        render(<OIDCProviderButtons providers={[google]} mode="signUp" />);
        expect(screen.getByTestId('oidc-google')).toHaveTextContent(
            'Sign up with Google'
        );
    });
});
