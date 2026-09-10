import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';

interface ExpansionValue {
    expandedUid: string | null;
    setExpandedUid: (uid: string | null) => void;
}

const TaskRowExpansionCtx = createContext<ExpansionValue | null>(null);

// Wraps a task list so that at most one row is expanded at a time. It is
// deliberately React state (not a global store): the provider unmounts on route
// change, so an expanded row never survives navigation.
export const TaskRowExpansionProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const [expandedUid, setExpandedUid] = useState<string | null>(null);
    const value = useMemo(
        () => ({ expandedUid, setExpandedUid }),
        [expandedUid]
    );
    return (
        <TaskRowExpansionCtx.Provider value={value}>
            {children}
        </TaskRowExpansionCtx.Provider>
    );
};

interface UseExpansionResult {
    isExpanded: boolean;
    toggle: () => void;
    collapse: () => void;
}

// When there is no provider, or `disabled` is set, expansion is a no-op and the
// caller falls back to navigating to the full task page.
export const useTaskRowExpansion = (
    uid: string | undefined,
    options?: { disabled?: boolean }
): UseExpansionResult => {
    const ctx = useContext(TaskRowExpansionCtx);
    const disabled = options?.disabled || !uid || !ctx;

    const isExpanded = !disabled && ctx!.expandedUid === uid;

    const toggle = useCallback(() => {
        if (disabled) return;
        ctx!.setExpandedUid(ctx!.expandedUid === uid ? null : uid!);
    }, [ctx, disabled, uid]);

    const collapse = useCallback(() => {
        if (!ctx) return;
        if (ctx.expandedUid === uid) ctx.setExpandedUid(null);
    }, [ctx, uid]);

    return { isExpanded, toggle, collapse };
};
