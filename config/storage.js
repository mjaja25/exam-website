const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Allowed file types per context
const ALLOWED_EXCEL_MIMES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv'
];
const ALLOWED_IMAGE_MIMES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// File filter that checks context
function fileFilter(req, file, cb) {
    if (req.originalUrl.includes('/profile')) {
        if (ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
            return cb(null, true);
        }
        return cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed for avatars.'), false);
    }
    // Excel uploads (admin templates + user submissions)
    if (ALLOWED_EXCEL_MIMES.includes(file.mimetype)) {
        return cb(null, true);
    }
    return cb(new Error('Only Excel files (.xlsx, .xls) and CSV files are allowed.'), false);
}

// 1. Dynamic Storage (Admin Templates vs User Submissions)
const dynamicStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: (req, file) => {
        let folder;
        
        if (req.originalUrl.includes('/admin/excel-questions')) {
            folder = 'excel_templates';
        } else if (req.originalUrl.includes('/profile')) {
            folder = 'user_avatars';
        } else {
            folder = 'excel_submissions';
        }
        
        const isImage = file.mimetype.startsWith('image/');
        
        return {
            folder: folder,
            resource_type: isImage ? 'image' : 'raw',
            public_id: `${path.parse(file.originalname).name}-${Date.now()}`
        };
    },
});

const upload = multer({ 
    storage: dynamicStorage, 
    fileFilter: fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
});

// 2. Specific Storages (Legacy support if needed)
const cloudinaryStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'excel_submissions', resource_type: 'raw', public_id: (req, file) => 'submission-' + Date.now() }
});
const uploadToCloudinary = multer({ 
    storage: cloudinaryStorage,
    fileFilter: fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
});

const localDiskStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'public/excel_files/') },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname) }
});
const uploadLocally = multer({ 
    storage: localDiskStorage,
    fileFilter: fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
});

module.exports = { 
    cloudinary, 
    upload, 
    uploadToCloudinary, 
    uploadLocally 
};