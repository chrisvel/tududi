'use strict';

const zlib = require('zlib');
const { ValidationError } = require('../../../shared/errors');

// An .xlsx is a zip of XML files, and ExcelJS inflates all of it in memory.
// A 5 MB upload can claim small sizes and still inflate to gigabytes, so
// every entry is inflated here first with a hard cap on what comes out;
// the sizes the archive declares are not trusted.
const MAX_ENTRIES = 2000;
// Comfortably more than a 5,000 x 60 sheet needs. ExcelJS builds the whole
// workbook in memory, at roughly 15 times the XML size.
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

function tooBig() {
    return new ValidationError(
        'The Excel file is too large once unpacked. Save it as .csv or split it into smaller files.'
    );
}

function unreadable() {
    return new ValidationError('Could not read the Excel file.');
}

function findEndOfCentralDirectory(buffer) {
    // The record is 22 bytes plus a comment of up to 64 KB.
    const start = Math.max(0, buffer.length - 22 - 0xffff);
    for (let i = buffer.length - 22; i >= start; i--) {
        if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
    }
    return -1;
}

function checkXlsxArchive(buffer) {
    const eocd = findEndOfCentralDirectory(buffer);
    if (eocd < 0) throw unreadable();
    const entries = buffer.readUInt16LE(eocd + 10);
    const directoryOffset = buffer.readUInt32LE(eocd + 16);
    if (entries > MAX_ENTRIES) throw tooBig();
    if (directoryOffset === 0xffffffff || entries === 0xffff) {
        // ZIP64: never needed for a file this small.
        throw unreadable();
    }

    let budget = MAX_TOTAL_BYTES;
    let offset = directoryOffset;
    // JSZip reads central headers for as long as their signature matches,
    // whatever count the end record gives, so the guard does the same and
    // refuses an archive whose count disagrees.
    let seen = 0;
    while (
        offset + 46 <= buffer.length &&
        buffer.readUInt32LE(offset) === CENTRAL_SIGNATURE
    ) {
        seen++;
        if (seen > MAX_ENTRIES) throw tooBig();
        const flags = buffer.readUInt16LE(offset + 8);
        const method = buffer.readUInt16LE(offset + 10);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const nameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localOffset = buffer.readUInt32LE(offset + 42);
        offset += 46 + nameLength + extraLength + commentLength;

        if (flags & 0x1) {
            throw new ValidationError(
                'The Excel file is password protected. Remove the password and try again.'
            );
        }
        if (
            localOffset + 30 > buffer.length ||
            buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE
        ) {
            throw unreadable();
        }
        const dataStart =
            localOffset +
            30 +
            buffer.readUInt16LE(localOffset + 26) +
            buffer.readUInt16LE(localOffset + 28);
        const data = buffer.subarray(dataStart, dataStart + compressedSize);
        if (data.length !== compressedSize) throw unreadable();

        let size;
        if (method === 0) {
            size = data.length;
        } else if (method === 8) {
            try {
                size = zlib.inflateRawSync(data, {
                    maxOutputLength: Math.max(budget, 1),
                }).length;
            } catch (error) {
                if (error.code === 'ERR_BUFFER_TOO_LARGE') throw tooBig();
                throw unreadable();
            }
        } else {
            throw unreadable();
        }
        budget -= size;
        if (budget < 0) throw tooBig();
    }
    if (seen !== entries || seen === 0) throw unreadable();
}

module.exports = { checkXlsxArchive, MAX_TOTAL_BYTES };
