const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.resolve(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: false });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 9
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('只能上传图片文件'));
    }
    cb(null, true);
  }
});

const uploadPhotos = upload.fields([
  { name: 'photos', maxCount: 9 },
  { name: 'photos[]', maxCount: 9 }
]);

function uploadedPhotos(req) {
  if (Array.isArray(req.files)) return req.files;
  return [
    ...((req.files && req.files.photos) || []),
    ...((req.files && req.files['photos[]']) || [])
  ];
}

function localUploadPath(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return null;
  const filename = path.basename(imageUrl);
  const resolved = path.resolve(uploadDir, filename);
  if (!resolved.startsWith(`${uploadDir}${path.sep}`)) return null;
  return resolved;
}

async function deleteLocalUpload(imageUrl) {
  const filePath = localUploadPath(imageUrl);
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Failed to delete upload: ${filePath}`, error.message);
    }
  }
}

module.exports = { upload, uploadPhotos, uploadedPhotos, uploadDir, deleteLocalUpload };
