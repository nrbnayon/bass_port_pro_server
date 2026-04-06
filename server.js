const express = require('express');
const dotenv  = require('dotenv');
const cors    = require('cors');
const morgan  = require('morgan');
const os      = require('os');
const path    = require('path');
const fs      = require('fs');
const connectDB = require('./config/db');
const https   = require('https');


// Load env vars
dotenv.config();

// Route files
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const auditRoutes = require('./routes/auditRoutes');
const leadRoutes = require('./routes/leadRoutes');
const taskRoutes = require('./routes/taskRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const cookieParser = require('cookie-parser');
const { cleanupBlacklist } = require('./utils/tokenBlacklist');
const seedAdmin = require('./scripts/seedAdmin');

// Connect to database
connectDB();
seedAdmin();

const app = express();

app.set('trust proxy', 1);

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// ── Static files: user avatar uploads ──────────────────────────────────────
// Accessible at: GET /uploads/users/<filename>
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Enable CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001,https://digital-pylot-frontend-five.vercel.app,https://console.cron-job.org')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed for this origin'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Dev logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Mount routers
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/settings', settingsRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  cleanupBlacklist().catch((error) => console.error('Blacklist cleanup failed:', error));

  setInterval(() => {
    cleanupBlacklist().catch((error) => console.error('Blacklist cleanup failed:', error));
  }, 60 * 60 * 1000);

  // Get local IP
  const interfaces = os.networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address;
        break;
      }
    }
  }
  
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`Local:            http://localhost:${PORT}`);
  console.log(`On Your Network:  http://${localIp}:${PORT}`);

  // Keep-Alive Ping (Prevent Render from sleeping)
  if (process.env.NODE_ENV === 'production') {
    const SERVICE_URL = process.env.RENDER_EXTERNAL_URL;
    if (SERVICE_URL) {
      setInterval(() => {
        https.get(SERVICE_URL, (res) => {
          console.log(`Keep-alive ping sent to ${SERVICE_URL}: Status ${res.statusCode}`);
        }).on('error', (err) => {
          console.error('Keep-alive ping failed:', err.message);
        });
      }, 14 * 60 * 1000); // 14 minutes
    } else {
      console.warn('RENDER_EXTERNAL_URL not found. Self-ping skipped.');
    }
  }
});

