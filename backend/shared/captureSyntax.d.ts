export function tokenizeCapture(content: string): string[];
export function hasTaskDirective(content: string): boolean;
export function parseTaskCapture(content: string): {
    name: string;
    projects: string[];
    tags: string[];
} | null;
