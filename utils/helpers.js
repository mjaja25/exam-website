function createDownloadUrl(url) {
    if (!url || !url.includes('cloudinary')) return url;
    const parts = url.split('/upload/');
    return `${parts[0]}/upload/fl_attachment/${parts[1]}`;
}

/**
 * Sanitize user-submitted content before embedding in AI prompts.
 * Strips common prompt injection patterns while preserving legitimate letter content.
 */
function sanitizeForAI(text) {
    if (!text || typeof text !== 'string') return '';
    
    // Remove common injection patterns
    let sanitized = text
        // Strip attempts to override system instructions
        .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi, '[removed]')
        .replace(/disregard\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi, '[removed]')
        .replace(/forget\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi, '[removed]')
        // Strip attempts to redefine role
        .replace(/you\s+are\s+now\s+/gi, '[removed]')
        .replace(/act\s+as\s+(if\s+)?(you\s+are\s+)?/gi, '[removed]')
        .replace(/pretend\s+(to\s+be|you\s+are)/gi, '[removed]')
        // Strip attempts to set scores directly
        .replace(/return\s+(only\s+)?json/gi, '[removed]')
        .replace(/(give|assign|set|return)\s+(me\s+)?(a\s+)?(score|marks?|grade|points?)\s*(of|=|:)?\s*\d+/gi, '[removed]')
        .replace(/(full|perfect|maximum)\s+(score|marks?|grade|points?)/gi, '[removed]');

    // Limit length to prevent token stuffing
    if (sanitized.length > 10000) {
        sanitized = sanitized.substring(0, 10000);
    }

    return sanitized;
}

module.exports = { createDownloadUrl, sanitizeForAI };