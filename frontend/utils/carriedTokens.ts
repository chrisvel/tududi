// The inbox edit box shows an item's cleaned title, without the date phrase,
// #tags, +project, @person and ~area the analysis cut out. Those words are
// "carried": kept out of view, shown as badges and added back on save.

const words = (line: string): string[] => line.split(/\s+/).filter(Boolean);

// Words of `original` that are not part of `cleaned`, in their order. The
// cleaned text keeps the original's words in order, so a longest common
// subsequence lines them up.
const missingWords = (original: string[], cleaned: string[]): string[] => {
    const rows = original.length;
    const cols = cleaned.length;
    const lengths: number[][] = Array.from({ length: rows + 1 }, () =>
        new Array(cols + 1).fill(0)
    );
    for (let i = rows - 1; i >= 0; i--) {
        for (let j = cols - 1; j >= 0; j--) {
            lengths[i][j] =
                original[i] === cleaned[j]
                    ? lengths[i + 1][j + 1] + 1
                    : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
        }
    }
    const missing: string[] = [];
    let i = 0;
    let j = 0;
    while (i < rows) {
        if (j < cols && original[i] === cleaned[j]) {
            i++;
            j++;
        } else if (j < cols && lengths[i][j + 1] > lengths[i + 1][j]) {
            j++;
        } else {
            missing.push(original[i]);
            i++;
        }
    }
    return missing;
};

export const carriedTokens = (original: string, cleaned: string): string => {
    const originalLines = original.trim().split('\n');
    const cleanedLines = cleaned.trim().split('\n');
    // Cleaning keeps the lines; if they do not line up, compare the whole text
    const pairs =
        originalLines.length === cleanedLines.length
            ? originalLines.map((line, index) => [line, cleanedLines[index]])
            : [[original, cleaned]];
    return pairs
        .flatMap(([line, cleanedLine]) =>
            missingWords(words(line), words(cleanedLine))
        )
        .join(' ');
};

// Text with the carried words added to its first line, where dates, people
// and areas are read.
export const withCarried = (text: string, carried: string): string => {
    const extra = carried.trim();
    if (!extra) return text;
    const newline = text.indexOf('\n');
    const first = newline < 0 ? text : text.slice(0, newline);
    const rest = newline < 0 ? '' : text.slice(newline);
    return `${first.trimEnd()}${first.trim() ? ' ' : ''}${extra}${rest}`;
};
