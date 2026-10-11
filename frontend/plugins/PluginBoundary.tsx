import React from 'react';

interface Props {
    pluginId: string;
    /** Shown when the plugin's contribution throws while rendering. */
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

interface State {
    error: Error | null;
}

/**
 * Contains a plugin that throws while rendering, so its own area shows a
 * fallback instead of the whole app going blank.
 *
 * This is containment, not a sandbox. A plugin runs in the host's realm with
 * the user's session, so it can still do anything the page can do; this only
 * stops an ordinary rendering mistake from taking the app down with it. It also
 * cannot catch errors thrown in event handlers or async callbacks, so those
 * paths are guarded where they are dispatched.
 */
export default class PluginBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // eslint-disable-next-line no-console
        console.error(
            `[plugin:${this.props.pluginId}] failed to render`,
            error,
            info.componentStack
        );
    }

    render() {
        if (this.state.error) {
            if (this.props.fallback !== undefined) {
                return this.props.fallback;
            }
            return (
                <div className="p-4 m-4 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
                    <p className="font-semibold">
                        {`Plugin "${this.props.pluginId}" could not be displayed.`}
                    </p>
                    <p className="mt-1 text-xs">{this.state.error.message}</p>
                </div>
            );
        }

        return this.props.children;
    }
}
