require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const regionRoutes = require('./routes/regions');
const checkinRoutes = require('./routes/checkins');
const photoRoutes = require('./routes/photos');
const statsRoutes = require('./routes/stats');
const mapRoutes = require('./routes/map');
const { uploadDir } = require('./upload');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.resolve(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'travel-glow',
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/map', mapRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
});

app.use((error, req, res, next) => {
  console.error(error);
  if (error.message === '只能上传图片文件') {
    return res.status(400).json({ message: error.message, code: 'INVALID_UPLOAD_TYPE' });
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: '单张图片不能超过 10MB', code: 'UPLOAD_TOO_LARGE' });
  }
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message, code: error.code || 'REQUEST_ERROR' });
  }
  if (error.code === 'P2002') {
    return res.status(409).json({ message: '账号名、邮箱或手机号已被使用', code: 'UNIQUE_CONSTRAINT' });
  }
  res.status(500).json({ message: '服务器错误', code: 'INTERNAL_ERROR', details: error.message });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Travel Glow running at http://localhost:${port}`);
  });
}

module.exports = app;
