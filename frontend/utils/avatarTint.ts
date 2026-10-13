const AVATAR_TINTS = [
    'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
    'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
    'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
    'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200',
];

// Same person, same color, so people are easy to tell apart at a glance.
export const avatarTint = (key: string) => {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash * 31 + key.charCodeAt(i)) | 0;
    }
    return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
};
