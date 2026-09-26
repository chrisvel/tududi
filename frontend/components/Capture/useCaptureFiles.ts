import { useCallback, useEffect, useRef, useState } from 'react';
import { getServerConfig } from '../../utils/configService';
import { CaptureTarget } from '../../utils/captureText';

// Only Inbox items and tasks can hold files.
export const FILE_TARGETS: CaptureTarget[] = ['inbox', 'task'];

// Same cap the server puts on one inbox item or task.
export const MAX_CAPTURE_FILES = 20;

const PREVIEW_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export interface CaptureFile {
    id: string;
    file: File;
    previewUrl: string | null;
}

export type CaptureFileError =
    | { kind: 'tooLarge'; name: string; limitMB: number }
    | { kind: 'tooMany'; max: number };

// What a paste should attach. Screenshots arrive as a file with no text.
// Copying cells from a spreadsheet brings text plus a picture of the cells,
// and the text is what was meant, so images that come with text are left to
// paste as text. Anything that is not an image (a file copied in Finder or
// Explorer) is always attached.
export const filesToAttachFromPaste = (data: DataTransfer): File[] => {
    const files = Array.from(data.files ?? []);
    if (files.length === 0) return [];
    const hasText = data.getData('text/plain').trim() !== '';
    const onlyImages = files.every((file) => file.type.startsWith('image/'));
    return hasText && onlyImages ? [] : files;
};

const pad = (n: number) => String(n).padStart(2, '0');

// Browsers call every pasted image "image.png", so give it a name that
// still means something in a list of attachments.
export const nameForPastedFile = (file: File, now = new Date()): File => {
    if (!/^image\.\w+$/i.test(file.name)) return file;
    const ext = file.name.split('.').pop();
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
    return new File([file], `Pasted image ${stamp}.${ext}`, {
        type: file.type,
        lastModified: file.lastModified,
    });
};

// A title for an item saved with files and no text.
export const titleFromFiles = (files: CaptureFile[]): string => {
    const name = files[0]?.file.name ?? '';
    return name.replace(/\.[^.]+$/, '') || name;
};

let nextId = 0;

export const useCaptureFiles = (onError: (error: CaptureFileError) => void) => {
    const [files, setFiles] = useState<CaptureFile[]>([]);
    const filesRef = useRef(files);
    filesRef.current = files;

    useEffect(
        () => () => {
            for (const entry of filesRef.current) {
                if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
            }
        },
        []
    );

    const addFiles = useCallback(
        async (incoming: File[]): Promise<number> => {
            if (incoming.length === 0) return 0;
            let limitMB = 10;
            try {
                limitMB = (await getServerConfig()).fileUploadLimitMB;
            } catch {
                // Keep the default; the server checks the size again.
            }

            const room = MAX_CAPTURE_FILES - filesRef.current.length;
            if (incoming.length > room) {
                onError({ kind: 'tooMany', max: MAX_CAPTURE_FILES });
            }

            const accepted: CaptureFile[] = [];
            for (const file of incoming.slice(0, Math.max(0, room))) {
                if (file.size > limitMB * 1024 * 1024) {
                    onError({ kind: 'tooLarge', name: file.name, limitMB });
                    continue;
                }
                accepted.push({
                    id: `capture-file-${(nextId += 1)}`,
                    file,
                    previewUrl: PREVIEW_TYPES.includes(file.type)
                        ? URL.createObjectURL(file)
                        : null,
                });
            }
            if (accepted.length > 0) {
                setFiles((current) => [...current, ...accepted]);
            }
            return accepted.length;
        },
        [onError]
    );

    const removeFile = useCallback((id: string) => {
        setFiles((current) => {
            const entry = current.find((f) => f.id === id);
            if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
            return current.filter((f) => f.id !== id);
        });
    }, []);

    const clearFiles = useCallback(() => {
        setFiles((current) => {
            for (const entry of current) {
                if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
            }
            return [];
        });
    }, []);

    return { files, addFiles, removeFile, clearFiles };
};
