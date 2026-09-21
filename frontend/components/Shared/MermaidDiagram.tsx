import React, { useEffect, useState } from 'react';

type MermaidApi = typeof import('mermaid').default;

let mermaidPromise: Promise<MermaidApi> | null = null;
let diagramCounter = 0;

// Mermaid is large, so it is only fetched (as its own chunk) once a note
// actually contains a diagram.
const loadMermaid = (): Promise<MermaidApi> => {
    if (!mermaidPromise) {
        mermaidPromise = import('mermaid')
            .then((module) => module.default)
            .catch((error) => {
                mermaidPromise = null;
                throw error;
            });
    }
    return mermaidPromise;
};

const hasMermaidClass = (className: unknown): boolean => {
    const classes = Array.isArray(className)
        ? className
        : typeof className === 'string'
          ? className.split(/\s+/)
          : [];
    return classes.includes('language-mermaid');
};

const collectText = (node: any): string => {
    if (!node) return '';
    if (node.type === 'text') return node.value || '';
    return (node.children || []).map(collectText).join('');
};

// Returns the diagram source when a hast <pre> node wraps a ```mermaid fence,
// otherwise null.
export const getMermaidSource = (preNode: any): string | null => {
    const codeNode = (preNode?.children || []).find(
        (child: any) => child.type === 'element' && child.tagName === 'code'
    );
    if (!codeNode || !hasMermaidClass(codeNode.properties?.className)) {
        return null;
    }
    return collectText(codeNode).replace(/\n$/, '');
};

const useIsDark = (): boolean => {
    const [isDark, setIsDark] = useState(() =>
        document.documentElement.classList.contains('dark')
    );

    useEffect(() => {
        const observer = new MutationObserver(() =>
            setIsDark(document.documentElement.classList.contains('dark'))
        );
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });
        return () => observer.disconnect();
    }, []);

    return isDark;
};

interface MermaidDiagramProps {
    code: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code }) => {
    const isDark = useIsDark();
    const [svg, setSvg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const id = `mermaid-diagram-${diagramCounter++}`;

        const render = async () => {
            try {
                const mermaid = await loadMermaid();
                mermaid.initialize({
                    startOnLoad: false,
                    // Notes can be shared publicly, so diagram source is
                    // untrusted: strict mode sanitizes labels and disables
                    // click handlers.
                    securityLevel: 'strict',
                    theme: isDark ? 'dark' : 'default',
                });
                await mermaid.parse(code);
                const result = await mermaid.render(id, code);
                if (!cancelled) {
                    setSvg(result.svg);
                    setError(null);
                }
            } catch (err) {
                // A failed render can leave its scratch element in the body
                document.getElementById(`d${id}`)?.remove();
                if (!cancelled) {
                    setSvg(null);
                    setError(err instanceof Error ? err.message : String(err));
                }
            }
        };

        render();

        return () => {
            cancelled = true;
        };
    }, [code, isDark]);

    if (error) {
        return (
            <div
                role="alert"
                className="mb-4 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 text-sm"
            >
                <p className="font-semibold text-red-700 dark:text-red-300 mb-2">
                    Could not render Mermaid diagram
                </p>
                <pre className="whitespace-pre-wrap text-red-700 dark:text-red-300 mb-2">
                    {error}
                </pre>
                <pre className="overflow-x-auto text-gray-700 dark:text-gray-300">
                    {code}
                </pre>
            </div>
        );
    }

    if (svg === null) {
        return (
            <div
                className="mb-4 rounded-lg bg-gray-100 dark:bg-gray-800 p-4 text-sm text-gray-500 dark:text-gray-400"
                aria-busy="true"
            >
                Rendering diagram...
            </div>
        );
    }

    return (
        <div
            role="img"
            aria-label="Mermaid diagram"
            className="mermaid-diagram mb-4 flex justify-center overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
};

export default MermaidDiagram;
