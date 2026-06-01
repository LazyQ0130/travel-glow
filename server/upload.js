const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const { AppError } = require('./errors');

const uploadDir = path.resolve(__dirname, 'uploads');
const avatarDir = path.resolve(uploadDir, 'avatars');
const DEFAULT_IMAGE_QUALITY = 80;
const DEFAULT_MAX_IMAGE_WIDTH = 1920;
const DEFAULT_MAX_IMAGE_HEIGHT = 1080;
const allowedImageTypes = new Map([
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['image/gif', new Set(['.gif'])],
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

function parseIntegerConfig(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function imageCompressionConfig() {
  return {
    quality: parseIntegerConfig(process.env.UPLOAD_IMAGE_QUALITY, DEFAULT_IMAGE_QUALITY, 1, 100),
    maxWidth: parseIntegerConfig(process.env.UPLOAD_IMAGE_MAX_WIDTH, DEFAULT_MAX_IMAGE_WIDTH, 1, 10000),
    maxHeight: parseIntegerConfig(process.env.UPLOAD_IMAGE_MAX_HEIGHT, DEFAULT_MAX_IMAGE_HEIGHT, 1, 10000)
  };
}

function imageFileFilter(req, file, cb) {
  if (!isAllowedImage(file)) {
    return cb(new AppError(400, 'Only JPG, PNG, GIF, and WEBP images are allowed.', 'INVALID_UPLOAD_TYPE'));
  }
  cb(null, true);
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 9
  },
  fileFilter: imageFileFilter
});

const uploadPhotoFields = upload.fields([
  { name: 'photos', maxCount: 9 },
  { name: 'photos[]', maxCount: 9 }
]);

const uploadAvatar = multer({
  storage,
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

function assignDestination(files, destination) {
  for (const file of files) {
    file.destination = destination;
  }
}

const uploadPhotos = (req, res, next) => {
  uploadPhotoFields(req, res, (error) => {
    if (error) return next(error);
    assignDestination(uploadedPhotos(req), uploadDir);
    next();
  });
};

function uploadAvatarSingle(fieldName) {
  const middleware = uploadAvatar.single(fieldName);
  return (req, res, next) => {
    middleware(req, res, (error) => {
      if (error) return next(error);
      if (req.file) req.file.destination = avatarDir;
      next();
    });
  };
}

function validateImageBuffer(buffer, mimetype) {
  // 通过文件头 magic number 校验真实图片类型，避免仅伪造扩展名或 MIME。
  if (mimetype === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimetype === 'image/gif') {
    const signature = buffer.subarray(0, 6).toString('ascii');
    return signature === 'GIF87a' || signature === 'GIF89a';
  }
  if (mimetype === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

async function hasValidImageSignature(file) {
  if (file.buffer) {
    return validateImageBuffer(file.buffer.subarray(0, 12), file.mimetype);
  }

  const handle = await fs.promises.open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const header = buffer.subarray(0, bytesRead);
    return validateImageBuffer(header, file.mimetype);
  } finally {
    await handle.close();
  }
}

function formatSharpImage(pipeline, mimetype, quality) {
  if (mimetype === 'image/jpeg') {
    return pipeline.jpeg({ quality, mozjpeg: true });
  }
  if (mimetype === 'image/png') {
    return pipeline.png({ quality, compressionLevel: 9, palette: true });
  }
  if (mimetype === 'image/gif') {
    return pipeline.gif({ effort: 10 });
  }
  if (mimetype === 'image/webp') {
    return pipeline.webp({ quality });
  }
  return pipeline;
}

async function compressUploadedImage(file) {
  const { quality, maxWidth, maxHeight } = imageCompressionConfig();
  const input = file.buffer || await fs.promises.readFile(file.path);
  const pipeline = sharp(input, { animated: file.mimetype === 'image/gif' })
    .rotate()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true
    });

  const compressed = await formatSharpImage(pipeline, file.mimetype, quality).toBuffer();
  file.destination = file.destination || path.dirname(file.path);
  file.filename = file.filename || randomFilename(file);
  file.path = path.join(file.destination, file.filename);
  await fs.promises.writeFile(file.path, compressed);
  file.size = compressed.length;
  delete file.buffer;
}

async function validateUploadedFiles(files) {
  for (const file of files) {
    if (!await hasValidImageSignature(file)) {
      throw new AppError(400, 'Uploaded file content does not match an allowed image type.', 'INVALID_UPLOAD_SIGNATURE');
    }
    await compressUploadedImage(file);
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
  uploadAvatar: { single: uploadAvatarSingle },
  uploadDir,
  avatarDir,
  deleteLocalUpload,
  imageCompressionConfig,
  validateImageBuffer,
  validateUploadedFiles
};
