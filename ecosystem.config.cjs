module.exports = {
    apps: [
        {
            name: 'e8-app',
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            instances: 1,
            exec_mode: 'fork',

            max_memory_restart: '4G',
            restart_delay: 10000,
            max_restarts: 20,
            min_uptime: '30s',

            env: {
                NODE_ENV: 'production',
                PORT: 3000,
                HOSTNAME: '0.0.0.0',
            },

            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: './logs/error.log',
            out_file: './logs/out.log',
            merge_logs: true,

            watch: false,
            ignore_watch: ['node_modules', '.git', 'logs'],

            kill_timeout: 10000,
            wait_ready: true,
            listen_timeout: 15000,

            node_args: [
                '--max-old-space-size=4096',
            ],
        },
        {
            name: 'cron-master',
            script: 'src/scripts/cron-master.ts',
            interpreter: 'node',
            node_args: '--import tsx',
            instances: 1,
            exec_mode: 'fork',

            max_memory_restart: '512M',
            restart_delay: 5000,

            env: {
                NODE_ENV: 'production',
                BASE_URL: 'http://127.0.0.1:3000',
            },

            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: './logs/cron-error.log',
            out_file: './logs/cron-out.log',
            merge_logs: true,
        },
        {
            name: 'e8-file-server',
            cwd: '/home/ubuntu/e8-file-server',   // <-- use the actual full path from where you cloned it
            script: 'src/index.js',
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '600M',
            restart_delay: 5000,
            env: {
                NODE_ENV: 'production',
                PORT: 4001,
            },
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: './logs/error.log',
            out_file: './logs/out.log',
            merge_logs: true,
        },
    ],
};
