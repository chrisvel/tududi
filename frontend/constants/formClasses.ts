// LTD-PATCH(T-301): Share quiet Life-to-Day presentation without changing behavior.
// Shared Tailwind classes for form controls, so every dropdown and field in
// tududi looks the same. The fills are translucent tints rather than borders,
// which keeps them visible on any surface (page, card or modal) in both modes.
const control =
    'min-h-[44px] rounded-lg bg-black/[0.04] dark:bg-white/[0.07] text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-opacity hover:bg-black/[0.06] dark:hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed';

export const FORM = {
    input: `${control} px-3 py-2`,
    // The arrow comes from the base `select` style in tailwind.css.
    select: `${control} appearance-none cursor-pointer py-2 ps-3 pe-9`,
    textarea: `${control} px-3 py-2`,
    label: 'block text-sm font-medium text-gray-700 dark:text-gray-300',
};
