const { decodeUploadFilename } = require('../../utils/attachment-utils');

describe('decodeUploadFilename', () => {
    it('leaves ASCII names unchanged', () => {
        expect(decodeUploadFilename('report 2026.pdf')).toBe('report 2026.pdf');
    });

    it('turns latin1-decoded UTF-8 bytes back into text', () => {
        const mojibake = Buffer.from('测试文档.pdf', 'utf8').toString('latin1');
        expect(decodeUploadFilename(mojibake)).toBe('测试文档.pdf');
    });

    it('keeps names that already contain characters above latin1', () => {
        expect(decodeUploadFilename('测试文档.pdf')).toBe('测试文档.pdf');
    });

    it('keeps a latin1 name that is not valid UTF-8', () => {
        const latin1Name = Buffer.from([0x63, 0x61, 0x66, 0xe9]).toString(
            'latin1'
        );
        expect(decodeUploadFilename(latin1Name)).toBe(latin1Name);
    });

    it('passes through a missing name', () => {
        expect(decodeUploadFilename(undefined)).toBeUndefined();
    });
});
