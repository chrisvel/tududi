import type ReactType from 'react';

/**
 * The host's React, captured at activation.
 *
 * JSX in this plugin compiles to `React.createElement`, so each component
 * resolves `React` from here at render time. Nothing in the plugin imports
 * React itself: a plugin that bundles its own copy and passes components back
 * into the host's renderer breaks hooks, and that is the most common way an
 * in-page plugin fails.
 */

let react: typeof ReactType | undefined;

export const setReact = (instance: typeof ReactType): void => {
    react = instance;
};

export const getReact = (): typeof ReactType => {
    if (!react) {
        throw new Error(
            'Calm Mode rendered before activate() supplied the host React instance'
        );
    }
    return react;
};
