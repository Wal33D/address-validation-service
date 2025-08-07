// ecosystem.config.js
// PM2 Configuration for Address Validation Service

module.exports = {
  apps: [
    {
      name: 'address-validation-service',
      script: 'dist/server.js',

      // Cluster mode with automatic CPU core detection
      exec_mode: 'cluster',
      instances: 'max', // Use all available CPU cores

      // Memory management
      max_memory_restart: '512M', // Restart if memory exceeds 512MB

      // Restart behavior
      autorestart: true,
      watch: false, // Don't watch in production
      max_restarts: 10,
      min_uptime: '20s', // App must run for 20s to be considered started

      // Logging
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true, // Add timestamps to logs
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3715,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3715,
        LOG_LEVEL: 'debug',
      },

      // Graceful shutdown
      kill_timeout: 5000, // 5 seconds to gracefully shutdown
      listen_timeout: 3000, // 3 seconds to be ready

      // Performance optimizations
      node_args: [
        '--max-old-space-size=512', // Limit heap to 512MB
        '--optimize-for-size', // Optimize for memory usage
        '--gc-interval=100', // More frequent garbage collection
      ].join(' '),

      // Health check
      cron_restart: '0 3 * * *', // Daily restart at 3 AM to prevent memory leaks

      // Monitoring
      instance_var: 'INSTANCE_ID', // Differentiate between cluster instances

      // Zero-downtime reload
      wait_ready: true, // Wait for ready signal

      // Dependencies
      post_update: ['npm install', 'npm run build'],
    },
  ],
};
