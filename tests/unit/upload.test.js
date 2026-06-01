const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const { imageCompressionConfig, uploadDir, validateUploadedFiles } = require('../../server/upload');

test('image compression config uses documented defaults', () => {
  const previousQuality = process.env.UPLOAD_IMAGE_QUALITY;
  const previousMaxWidth = process.env.UPLOAD_IMAGE_MAX_WIDTH;
  const previousMaxHeight = process.env.UPLOAD_IMAGE_MAX_HEIGHT;
  delete process.env.UPLOAD_IMAGE_QUALITY;
  delete process.env.UPLOAD_IMAGE_MAX_WIDTH;
  delete process.env.UPLOAD_IMAGE_MAX_HEIGHT;

  try {
    assert.deepEqual(imageCompressionConfig(), {
      quality: 80,
      maxWidth: 1920,
      maxHeight: 1080
    });
  } finally {
    if (previousQuality === undefined) delete process.env.UPLOAD_IMAGE_QUALITY;
    else process.env.UPLOAD_IMAGE_QUALITY = previousQuality;
    if (previousMaxWidth === undefined) delete process.env.UPLOAD_IMAGE_MAX_WIDTH;
    else process.env.UPLOAD_IMAGE_MAX_WIDTH = previousMaxWidth;
    if (previousMaxHeight === undefined) delete process.env.UPLOAD_IMAGE_MAX_HEIGHT;
    else process.env.UPLOAD_IMAGE_MAX_HEIGHT = previousMaxHeight;
  }
});

test('validateUploadedFiles compresses images while preserving format', async () => {
  const previousQuality = process.env.UPLOAD_IMAGE_QUALITY;
  const previousMaxWidth = process.env.UPLOAD_IMAGE_MAX_WIDTH;
  const previousMaxHeight = process.env.UPLOAD_IMAGE_MAX_HEIGHT;
  process.env.UPLOAD_IMAGE_QUALITY = '70';
  process.env.UPLOAD_IMAGE_MAX_WIDTH = '320';
  process.env.UPLOAD_IMAGE_MAX_HEIGHT = '180';

  let filePath;

  try {
    const input = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 80, g: 120, b: 200 }
      }
    }).jpeg({ quality: 100 }).toBuffer();

    const file = {
      buffer: input,
      destination: uploadDir,
      mimetype: 'image/jpeg',
      originalname: `upload-compress-${process.pid}-${Date.now()}.jpg`,
      size: input.length
    };

    await validateUploadedFiles([file]);

    filePath = path.join(uploadDir, file.filename);
    const after = await fs.promises.stat(filePath);
    const metadata = await sharp(filePath).metadata();
    assert.equal(metadata.format, 'jpeg');
    assert.ok(metadata.width <= 320);
    assert.ok(metadata.height <= 180);
    assert.equal(file.size, after.size);
    assert.ok(file.size < input.length);
    assert.equal(file.buffer, undefined);
  } finally {
    if (previousQuality === undefined) delete process.env.UPLOAD_IMAGE_QUALITY;
    else process.env.UPLOAD_IMAGE_QUALITY = previousQuality;
    if (previousMaxWidth === undefined) delete process.env.UPLOAD_IMAGE_MAX_WIDTH;
    else process.env.UPLOAD_IMAGE_MAX_WIDTH = previousMaxWidth;
    if (previousMaxHeight === undefined) delete process.env.UPLOAD_IMAGE_MAX_HEIGHT;
    else process.env.UPLOAD_IMAGE_MAX_HEIGHT = previousMaxHeight;
    if (filePath) {
      await fs.promises.unlink(filePath).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }
});
