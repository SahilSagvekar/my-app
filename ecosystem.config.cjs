module.exports = {
    apps: [
        {
            name: 'e8-app',
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            instances: 1, // Single instance to avoid connection pool conflicts
            exec_mode: 'fork', // Use fork mode for Next.js

            // ✅ Auto-restart settings
            max_memory_restart: '1G', // Restart if memory exceeds 1GB
            restart_delay: 5000, // Wait 5s before restart
            max_restarts: 10, // Max restarts in exp_backoff_restart_delay window

            // ✅ Cron-based restart to prevent memory leaks
            cron_restart: '*/30 * * * *',

            // ✅ Environment
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            },

            // ✅ Logging
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: './logs/error.log',
            out_file: './logs/out.log',
            merge_logs: true,

            // ✅ Watch settings (disabled for production)
            watch: false,
            ignore_watch: ['node_modules', '.git', 'logs'],

            // ✅ Graceful shutdown
            kill_timeout: 10000, // Give 10s for graceful shutdown
            wait_ready: true,
            listen_timeout: 10000,

            // ✅ Node.js args for better memory handling
            node_args: [
                '--max-old-space-size=1024', // Limit heap size
            ],
        },
    ],
};
