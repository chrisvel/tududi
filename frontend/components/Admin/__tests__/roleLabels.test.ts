import { TFunction } from 'i18next';
import { roleDescription, roleName } from '../roleLabels';

const t = ((_key: string, fallback: string) => fallback) as unknown as TFunction;

describe('roleLabels', () => {
    it('calls the instance admin the superadmin on a hosted instance', () => {
        expect(roleName(t, 'admin', true)).toBe('Superadmin');
        expect(roleDescription(t, 'admin', true)).toContain(
            'Customers never get this role'
        );
    });

    it('keeps Admin on a self-hosted instance', () => {
        expect(roleName(t, 'admin')).toBe('Admin');
        expect(roleName(t, 'admin', false)).toBe('Admin');
    });

    it('leaves the other roles alone', () => {
        expect(roleName(t, 'user', true)).toBe('User');
        expect(roleName(t, 'guest', true)).toBe('Guest');
    });
});
