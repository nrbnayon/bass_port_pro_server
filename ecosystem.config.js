module.exports = {
  apps: [
    {
      // Backend API
      name: 'backend',
      script: 'server.js',
      node_args: '--max-old-space-size=1024 --expose-gc',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      
      // Auto-restart on memory leak
      watch: false,
      ignore_watch: ['node_modules', 'uploads', '.git'],
      
      // Memory limit: Restart if exceeds 2GB
      max_memory_restart: '2G',
      
      // CPU limit monitoring
      max_cpu_usage: 90,
      
      // Graceful shutdown: Wait 10 seconds for connections to close
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Logging
      merge_logs: true,
      output: 'logs/backend-out.log',
      error: 'logs/backend-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto-restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: 60000,
      
      shutdown_with_message: true,
    }
  ],

  // Global settings
  deploy: {
    production: {
      user: 'root',
      host: 'bassport.tech',
      ref: 'origin/main',
      repo: 'https://github.com/nrbnayon/bass_port_pro_server.git',
      path: '/var/www/bass_port_pro_server',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying backend to production"'
    }
  }
};
