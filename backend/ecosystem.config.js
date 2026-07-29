module.exports = {
  apps: [
    {
      name: 'neurecore-backend',
      script: 'dist/src/main.js',
      cwd: '/home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: '/tmp/neurecore-backend-err.log',
      out_file: '/tmp/neurecore-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
