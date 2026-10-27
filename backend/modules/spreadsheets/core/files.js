'use strict';

const ExcelJS = require('exceljs');
const iconv = require('iconv-lite');
const { parse: parseCsv } = require('csv-parse/sync');
const { ValidationError } = require('../../../shared/errors');

const MAX_ROWS = 5000;
const MAX_COLUMNS = 60;
const MAX_CELL_LENGTH = 10000;

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
        .replace(/^'(?=[=+\-@])/, '')
        .slice(0, MAX_CELL_LENGTH);
}

// Drops trailing empty rows and columns, caps the size, and keeps the
// spreadsheet row number of every row so problems can point at it.
function finishSheet(name, rawRows, rawLevels = []) {
    const rows = [];
    const levels = [];
    const rowNumbers = [];
    let truncatedRows = false;
    rawRows.forEach((cells, i) => {
        const values = cells.map(clean);
        if (!values.some(Boolean)) return;
        if (rows.length >= MAX_ROWS + 1) {
            truncatedRows = true;
            return;
        }
        rows.push(values);
        levels.push(rawLevels[i] || 0);
        rowNumbers.push(i + 1);
    });

    const width = Math.min(
        MAX_COLUMNS,
        rows.reduce((max, row) => {
            let last = row.length;
            while (last > 0 && !row[last - 1]) last--;
            return Math.max(max, last);
        }, 0)
    );
    const truncatedColumns = rows.some((row) =>
        row.slice(MAX_COLUMNS).some(Boolean)
    );

    return {
        name,
        rows: rows.map((row) =>
            Array.from({ length: width }, (_, c) => row[c] || '')
        ),
        levels,
        row_numbers: rowNumbers,
        truncated: truncatedRows || truncatedColumns,
    };
}

function decodeText(buffer, encoding) {
    if (encoding && encoding !== 'auto') {
        if (!iconv.encodingExists(encoding)) {
            throw new ValidationError('Unknown text encoding.');
        }
        return iconv.decode(buffer, encoding);
    }
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
        return iconv.decode(buffer.subarray(2), 'utf16le');
    }
    if (buffer[0] === 0xfe && buffer[1] === 0xff) {
        return iconv.decode(buffer.subarray(2), 'utf16be');
    }
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        // Not UTF-8: Excel on Windows saves CSV in the system code page.
        return iconv.decode(buffer, 'win1252');
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

function readCsv(buffer, encoding) {
    const text = decodeText(buffer, encoding).replace(/^\ufeff/, '');
    let records;
    try {
        records = parseCsv(text, {
            delimiter: detectDelimiter(text),
            relax_column_count: true,
            relax_quotes: true,
            skip_empty_lines: false,
        });
    } catch (error) {
        throw new ValidationError(
            `Could not read the CSV file: ${error.message}`
        );
    }
    return [finishSheet('CSV', records)];
}

async function readXlsx(buffer) {
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.load(buffer);
    } catch {
        throw new ValidationError('Could not read the Excel file.');
    }

    const sheets = [];
    workbook.eachSheet((worksheet) => {
        if (worksheet.state && worksheet.state !== 'visible') return;
        const rawRows = [];
        const rawLevels = [];
        worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
            const cells = [];
            let indent = 0;
            row.eachCell({ includeEmpty: true }, (cell, column) => {
                cells[column - 1] = cellText(cell.value);
                if (!indent && cells[column - 1].trim()) {
                    indent = cell.alignment?.indent || 0;
                }
            });
            rawRows[rowNumber - 1] = Array.from(cells, (c) => c || '');
            rawLevels[rowNumber - 1] = row.outlineLevel || indent || 0;
        });
        const sheet = finishSheet(
            worksheet.name,
            Array.from(rawRows, (r) => r || []),
            rawLevels
        );
        if (sheet.rows.length > 0) sheets.push(sheet);
    });
    return sheets;
}

// Reads an uploaded file into sheets of trimmed strings.
async function readSpreadsheet(buffer, fileName = '', { encoding } = {}) {
    const lowerName = fileName.toLowerCase();
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
    if (lowerName.endsWith('.xls') && !isZip) {
        throw new ValidationError(
            'Old .xls files are not supported. Save the file as .xlsx or .csv and try again.'
        );
    }
    const sheets = isZip ? await readXlsx(buffer) : readCsv(buffer, encoding);
    if (sheets.length === 0) {
        throw new ValidationError('The file has no rows.');
    }
    return sheets;
}

function csvEscape(value) {
    const text = value === null || value === undefined ? '' : String(value);
    // A leading = + - @ makes Excel run the cell as a formula.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
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
    readSpreadsheet,
    writeCsv,
    writeXlsx,
    detectDelimiter,
    formatExcelDate,
};
