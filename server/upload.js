const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { AppError } = require('./errors');

const uploadDir = path.resolve(__dirname, 'uploads');
const avatarDir = path.resolve(uploadDir, 'avatars');
const allowedImageTypes = new Map([
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['image/webp', new Set(['.webp'])]
]);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: false });
}
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: false });
}

function randomFilename(file) {
  const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  return `${Date.now()}-${crypto.randomUUID()}${ext}`;
}

function isAllowedImage(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const extensions = allowedImageTypes.get(file.mimetype);
  return Boolean(extensions && extensions.has(ext));
}

function imageFileFilter(req, file, cb) {
  if (!isAllowedImage(file)) {
    return cb(new AppError(400, 'Only JPG, PNG, and WEBP images are allowed.', 'INVALID_UPLOAD_TYPE'));
  }
  cb(null, true);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, randomFilename(file))
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 9
  },
  fileFilter: imageFileFilter
});

const uploadPhotos = upload.fields([
  { name: 'photos', maxCount: 9 },
  { name: 'photos[]', maxCount: 9 }
]);

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => cb(null, randomFilename(file))
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: imageFileFilter
});

function uploadedPhotos(req) {
  if (Array.isArray(req.files)) return req.files;
  return [
    ...((req.files && req.files.photos) || []),
    ...((req.files && req.files['photos[]']) || [])
  ];
}

async function hasValidImageSignature(file) {
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const header = buffer.subarray(0, bytesRead);

    if (file.mimetype === 'image/jpeg') {
      return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    }
    if (file.mimetype === 'image/png') {
      return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (file.mimetype === 'image/webp') {
      return header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP';
    }
    return false;
  } finally {
    await handle.close();
  }
}

async function validateUploadedFiles(files) {
  for (const file of files) {
    if (!await hasValidImageSignature(file)) {
      throw new AppError(400, 'Uploaded file content does not match an allowed image type.', 'INVALID_UPLOAD_SIGNATURE');
    }
  }
}

function localUploadPath(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return null;
  const relativePath = imageUrl.replace('/uploads/', '').split('/').map((part) => path.basename(part));
  const resolved = path.resolve(uploadDir, ...relativePath);
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

module.exports = {
  upload,
  uploadPhotos,
  uploadedPhotos,
  uploadAvatar,
  uploadDir,
  avatarDir,
  deleteLocalUpload,
  validateUploadedFiles
};
