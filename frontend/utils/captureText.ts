export type CaptureTarget = 'inbox' | 'task' | 'note' | 'project';

export const CAPTURE_TARGETS: CaptureTarget[] = [
    'inbox',
    'task',
    'note',
    'project',
];

export interface CapturedItem {
    target: CaptureTarget;
    uid?: string;
    title: string;
}

const BULLET = /^\s*(?:[-*•]|\d+[.)]|\[[ xX]\])\s+/;

export const nonEmptyLines = (text: string): string[] =>
    text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

export const stripBullet = (line: string): string => line.replace(BULLET, '');

// One raw text per item that will be created. Without "one item per line"
// the whole text is a single item, however many lines it has.
export const splitCaptureText = (
    text: string,
    oneItemPerLine: boolean
): string[] => {
    const trimmed = text.trim();
    if (!trimmed) {
        return [];
    }
    if (!oneItemPerLine) {
        return [trimmed];
    }
    return nonEmptyLines(trimmed).map(stripBullet).filter(Boolean);
};

// The first line is the title, the other lines are the body or notes.
export const splitFirstLine = (
    text: string
): { first: string; rest: string } => {
    const trimmed = text.trim();
    const newline = trimmed.indexOf('\n');
    if (newline < 0) {
        return { first: trimmed, rest: '' };
    }
    return {
        first: trimmed.slice(0, newline).trim(),
        rest: trimmed.slice(newline + 1).trim(),
    };
};
