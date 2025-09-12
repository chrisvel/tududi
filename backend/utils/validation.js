function validateTagName(name) {
    if (!name || !name.trim()) {
        return { valid: false, error: 'Tag name is required' };
    }

    const trimmedName = name.trim();

    // Check for invalid characters that can break URLs or cause issues
    const invalidChars = /[#%&{}\\<>*?/$!'"@+`|=]/;
    if (invalidChars.test(trimmedName)) {
        return {
            valid: false,
            error: 'Tag name contains invalid characters. Please avoid: # % & { } \\ < > * ? / $ ! \' " @ + ` | =',
        };
    }

    // Check length limits
    if (trimmedName.length > 50) {
        return {
            valid: false,
            error: 'Tag name must be 50 characters or less',
        };
    }

    if (trimmedName.length < 1) {
        return { valid: false, error: 'Tag name cannot be empty' };
    }

    return { valid: true, name: trimmedName };
}

module.exports = {
    validateTagName,
};
