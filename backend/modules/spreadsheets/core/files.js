'use strict';

const { withReason } = require('./errors');
const ExcelJS = require('exceljs');
const iconv = require('iconv-lite');
const { parse: parseCsv } = require('csv-parse/sync');
const {
    ValidationError,
    ServiceUnavailableError,
} = require('../../../shared/errors');
const { checkXlsxArchive } = require('./zipGuard');

const MAX_ROWS = 5000;
const MAX_COLUMNS = 60;
const MAX_CELL_LENGTH = 10000;
// All the text kept from one file. Shared strings let a small .xlsx repeat
// one long cell thousands of times, and the rows are stored until commit.
const MAX_TOTAL_CHARS = 8 * 1000 * 1000;

function pad(n) {
    return String(n).padStart(2, '0');
}

// Spreadsheet dates carry no timezone: Excel stores the wall clock and
// ExcelJS hands it over as that wall clock in UTC.
function formatExcelDate(date) {
    if (Number.isNaN(date.getTime())) return '';
    const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    return hours || minutes ? `${day} ${pad(hours)}:${pad(minutes)}` : day;
}

function cellText(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return formatExcelDate(value);
    if (typeof value === 'object') {
        if (Array.isArray(value.richText)) {
            return value.richText.map((part) => part.text).join('');
        }
        if ('result' in value) return cellText(value.result);
        if ('text' in value) return cellText(value.text);
        if ('error' in value) return '';
        return '';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value)
            ? String(value)
            : String(+value.toFixed(6));
    }
    return String(value);
}

// Strips what exports add to stop Excel reading a cell as a formula.
function clean(text) {
    return String(text)
        .replace(/\u00a0/g, ' ')
        .trim()
        .replace(/^'(?=[=+\-@|\uff1d\uff0b\uff0d\uff20])/, '')
        .slice(0, MAX_CELL_LENGTH);
}

// Drops trailing empty rows and columns, caps the size, and keeps the
// spreadsheet row number of every row so problems can point at it.
// Turns raw rows ({ cells, level, rowNumber }, empty ones already dropped
// or dropped here) into a sheet: capped at MAX_ROWS data rows plus a header
// and MAX_COLUMNS columns, trailing empty columns trimmed, each row keeping
// its spreadsheet row number so problems can point at it.
function finishSheet(name, entries, budget = { chars: MAX_TOTAL_CHARS }) {
    const rows = [];
    const levels = [];
    const rowNumbers = [];
    let truncated = false;
    for (const entry of entries) {
        if (entry.cells.length > MAX_COLUMNS) {
            if (entry.cells.slice(MAX_COLUMNS).some((c) => clean(c))) {
                truncated = true;
            }
        }
        const values = entry.cells.slice(0, MAX_COLUMNS).map(clean);
        if (!values.some(Boolean)) continue;
        if (rows.length >= MAX_ROWS + 1) {
            truncated = true;
            break;
        }
        // Counted as stored: JSON escapes control characters into several
        // bytes each.
        budget.chars -= JSON.stringify(values).length;
        if (budget.chars < 0) {
            throw withReason(
                new ValidationError(
                    'The file holds too much text to import at once. Split it into smaller files.'
                ),
                'too_much_text'
            );
        }
        rows.push(values);
        levels.push(entry.level || 0);
        rowNumbers.push(entry.rowNumber);
    }

    const width = rows.reduce((max, row) => {
        let last = row.length;
        while (last > 0 && !row[last - 1]) last--;
        return Math.max(max, last);
    }, 0);

    return {
        name,
        rows: rows.map((row) =>
            Array.from({ length: width }, (_, c) => row[c] || '')
        ),
        levels,
        row_numbers: rowNumbers,
        truncated,
    };
}

// Code pages Excel on Windows saves CSV in, offered when a file is not
// UTF-8. Anything else is refused rather than passed to iconv.
const ENCODINGS = [
    'utf8',
    'win1252',
    'win1250',
    'win1251',
    'win1253',
    'win1254',
    'win1256',
    'win1257',
    'shift_jis',
    'gbk',
    'big5',
    'euc-kr',
    'win874',
    'win1258',
];

function decodeText(buffer, encoding) {
    if (encoding && encoding !== 'auto') {
        if (!ENCODINGS.includes(encoding)) {
            throw withReason(
                new ValidationError('Unknown text encoding.'),
                'bad_encoding'
            );
        }
        return { text: iconv.decode(buffer, encoding), encoding };
    }
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
        return {
            text: iconv.decode(buffer.subarray(2), 'utf16le'),
            encoding: 'utf16le',
        };
    }
    if (buffer[0] === 0xfe && buffer[1] === 0xff) {
        return {
            text: iconv.decode(buffer.subarray(2), 'utf16be'),
            encoding: 'utf16be',
        };
    }
    try {
        return {
            text: new TextDecoder('utf-8', { fatal: true }).decode(buffer),
            encoding: 'utf8',
        };
    } catch {
        // Not UTF-8: Excel on Windows saves CSV in the system code page,
        // which cannot be told apart reliably. Western European is the
        // guess; the wizard offers the others.
        return { text: iconv.decode(buffer, 'win1252'), encoding: 'win1252' };
    }
}

// Picks the separator that splits the first lines most consistently.
function detectDelimiter(text) {
    const lines = text
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .slice(0, 10);
    let best = ',';
    let bestScore = 0;
    for (const delimiter of [',', ';', '\t', '|']) {
        const counts = lines.map((line) => {
            let count = 0;
            let quoted = false;
            for (const char of line) {
                if (char === '"') quoted = !quoted;
                else if (char === delimiter && !quoted) count++;
            }
            return count;
        });
        const min = Math.min(...counts);
        const score = min > 0 ? min * 10 + counts.length : 0;
        if (score > bestScore) {
            best = delimiter;
            bestScore = score;
        }
    }
    return best;
}

function readCsv(buffer, requested) {
    const decoded = decodeText(buffer, requested);
    const text = decoded.text.replace(/^\ufeff/, '');
    let records;
    try {
        records = parseCsv(text, {
            delimiter: detectDelimiter(text),
            relax_column_count: true,
            relax_quotes: true,
            skip_empty_lines: true,
            skip_records_with_empty_values: true,
            info: true,
            // One past the limit, so a cut-short file is flagged.
            to: MAX_ROWS + 2,
        });
    } catch (error) {
        throw withReason(
            new ValidationError(
                `Could not read the CSV file: ${error.message}`
            ),
            'csv_unreadable'
        );
    }
    return {
        sheets: [
            finishSheet(
                'CSV',
                records.map(({ record, info }) => ({
                    cells: record,
                    rowNumber: info.lines,
                }))
            ),
        ],
        encoding: decoded.encoding,
    };
}

// Excel files are parsed whole and in memory, so only a couple at a time.
const MAX_PARALLEL_XLSX = 2;
let xlsxInProgress = 0;

async function readXlsx(buffer) {
    checkXlsxArchive(buffer);
    if (xlsxInProgress >= MAX_PARALLEL_XLSX) {
        throw withReason(
            new ServiceUnavailableError(
                'Busy reading other files. Try again in a moment.'
            ),
            'busy'
        );
    }
    xlsxInProgress++;
    try {
        return await parseXlsx(buffer);
    } finally {
        xlsxInProgress--;
    }
}

async function parseXlsx(buffer) {
    const budget = { chars: MAX_TOTAL_CHARS };
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.load(buffer);
    } catch {
        throw withReason(
            new ValidationError('Could not read the Excel file.'),
            'xlsx_unreadable'
        );
    }

    const sheets = [];
    workbook.eachSheet((worksheet) => {
        if (worksheet.state && worksheet.state !== 'visible') return;
        const entries = [];
        let filled = 0;
        worksheet.eachRow((row, rowNumber) => {
            // Rows past the limit are only counted, so the sheet is flagged
            // as cut short; eachRow cannot stop early.
            if (filled > MAX_ROWS + 1) return;
            const cells = [];
            let indent = 0;
            row.eachCell((cell, column) => {
                if (column > MAX_COLUMNS + 1) return;
                // A merged range repeats its value in every cell it covers;
                // only the top-left one holds it, so a merged title row does
                // not read as a row of headers.
                if (cell.isMerged && cell.master !== cell) return;
                const text = cellText(cell.value);
                cells[column - 1] = text;
                if (!indent && text.trim()) {
                    indent = cell.alignment?.indent || 0;
                }
            });
            const dense = Array.from(cells, (c) => c || '');
            if (dense.some((c) => c.trim())) filled++;
            entries.push({
                cells: dense,
                level: row.outlineLevel || indent || 0,
                rowNumber,
            });
        });
        const sheet = finishSheet(worksheet.name, entries, budget);
        if (sheet.rows.length > 0) sheets.push(sheet);
    });
    return sheets;
}

// Reads an uploaded file into sheets of trimmed strings.
async function readSpreadsheet(buffer, fileName = '', { encoding } = {}) {
    const lowerName = fileName.toLowerCase();
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
    if (lowerName.endsWith('.xls') && !isZip) {
        throw withReason(
            new ValidationError(
                'Old .xls files are not supported. Save the file as .xlsx or .csv and try again.'
            ),
            'old_xls'
        );
    }
    const result = isZip
        ? { sheets: await readXlsx(buffer), encoding: null }
        : readCsv(buffer, encoding);
    if (result.sheets.length === 0 || result.sheets[0].rows.length === 0) {
        throw withReason(
            new ValidationError('The file has no rows.'),
            'no_rows'
        );
    }
    return result;
}

function csvEscape(value) {
    const text = value === null || value === undefined ? '' : String(value);
    // A leading = + - @ makes Excel run the cell as a formula.
    // Fullwidth forms count too: some Excel builds run them as formulas.
    const safe = /^[=+\-@\t\r|\uff1d\uff0b\uff0d\uff20]/.test(text)
        ? `'${text}`
        : text;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// UTF-8 with a byte order mark, which is what makes Excel read accents.
function writeCsv(headers, rows) {
    const lines = [headers, ...rows].map((row) =>
        row.map((cell) => csvEscape(cell?.text ?? cell)).join(',')
    );
    return Buffer.from(`\ufeff${lines.join('\r\n')}\r\n`, 'utf8');
}

// `columns`: [{ header, width, type: 'text' | 'date' | 'datetime' | 'number',
// list }]; cells may be { text, date } where `date` is a wall-clock Date.
async function writeXlsx({ sheetName, columns, rows, extraSheets = [] }) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'tududi';
    const worksheet = workbook.addWorksheet(sheetName.slice(0, 31), {
        views: [{ state: 'frozen', ySplit: 1 }],
    });
    worksheet.columns = columns.map((column) => ({
        header: column.header,
        width: column.width || 16,
        style:
            column.type === 'date'
                ? { numFmt: 'yyyy-mm-dd' }
                : column.type === 'datetime'
                  ? { numFmt: 'yyyy-mm-dd hh:mm' }
                  : {},
    }));
    worksheet.getRow(1).font = { bold: true };

    for (const row of rows) {
        worksheet.addRow(
            row.map((cell) => {
                if (cell && typeof cell === 'object') {
                    return cell.date || cell.text || null;
                }
                return cell === '' ? null : cell;
            })
        );
    }
    worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length },
    };

    // Dropdowns for the columns that take a fixed set of words, reaching a
    // little past the data so new rows get them too.
    const lastRow = Math.max(rows.length + 200, 500);
    columns.forEach((column, i) => {
        if (!column.list) return;
        const formula = `"${column.list.map((v) => v.replace(/[",]/g, ' ')).join(',')}"`;
        if (formula.length > 255) return;
        const letter = worksheet.getColumn(i + 1).letter;
        worksheet.dataValidations.add(`${letter}2:${letter}${lastRow}`, {
            type: 'list',
            allowBlank: true,
            formulae: [formula],
            showErrorMessage: false,
        });
    });

    for (const extra of extraSheets) {
        const sheet = workbook.addWorksheet(extra.name.slice(0, 31));
        sheet.columns = [{ width: 110 }];
        extra.lines.forEach((line, i) => {
            const row = sheet.addRow([line]);
            if (i === 0) row.font = { bold: true, size: 13 };
        });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = {
    MAX_ROWS,
    ENCODINGS,
    readSpreadsheet,
    writeCsv,
    writeXlsx,
    detectDelimiter,
    formatExcelDate,
};
