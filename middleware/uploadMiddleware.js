const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ALLOWED_DIRS = new Set(['users', 'lakes', 'catches', 'fishingReport']);

const normalizeDir = (dir) => (ALLOWED_DIRS.has(dir) ? dir : 'users');

const createUploadMiddleware = (subdir = 'users') => {
  const safeSubdir = normalizeDir(subdir);

  // ─── Storage engine ────────────────────────────────────────────────────────
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(__dirname, '..', 'uploads', safeSubdir);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },

    filename: (req, file, cb) => {
      const userId = req.user?._id?.toString() || 'file';
      const ts = Date.now();
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${userId}-${ts}${ext}`);
    },
  });

  // ─── File filter ───────────────────────────────────────────────────────────
  const fileFilter = (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype.split('/')[1]);

    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed'), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB cap
  });
};

module.exports = createUploadMiddleware;
