function createDownloadUrl(url) {
    if (!url || !url.includes('cloudinary')) return url;
    const parts = url.split('/upload/');
    return `${parts[0]}/upload/fl_attachment/${parts[1]}`;
}

module.exports = { createDownloadUrl };