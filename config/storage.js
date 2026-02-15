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

// 1. Dynamic Storage (Admin Templates vs User Submissions)
const dynamicStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: (req, file) => {
        let folder;
        // Debugging
        // console.log('Upload Path Check:', req.path, req.baseUrl, req.originalUrl);
        
        if (req.originalUrl.includes('/admin/excel-questions')) {
            folder = 'excel_templates';
        } else if (req.originalUrl.includes('/profile')) {
            folder = 'user_avatars'; // New folder for avatars
        } else {
            folder = 'excel_submissions';
        }
        
        // For avatars, we want image format, not raw
        const isImage = file.mimetype.startsWith('image/');
        
        return {
            folder: folder,
            resource_type: isImage ? 'image' : 'raw',
            public_id: `${path.parse(file.originalname).name}-${Date.now()}`
        };
    },
});

const upload = multer({ storage: dynamicStorage });

// 2. Specific Storages (Legacy support if needed)
const cloudinaryStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'excel_submissions', resource_type: 'raw', public_id: (req, file) => 'submission-' + Date.now() }
});
const uploadToCloudinary = multer({ storage: cloudinaryStorage });

const localDiskStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'public/excel_files/') },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname) }
});
const uploadLocally = multer({ storage: localDiskStorage });

module.exports = { 
    cloudinary, 
    upload, 
    uploadToCloudinary, 
    uploadLocally 
};