import { TFunction } from 'i18next';
import { Person } from '../../entities/Person';

// What a member is called in People: the account owner, an admin, or a
// plain member.
export const memberRoleLabel = (person: Person, t: TFunction): string => {
    switch (person.account_role) {
        case 'owner':
            return t('people.owner', 'Owner');
        case 'admin':
            return t('people.admin', 'Admin');
        default:
            return t('people.member', 'Member');
    }
};
