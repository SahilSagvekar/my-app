module.exports = {
    apps: [
        {
            name: 'e8-app',
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            instances: 1,
            exec_mode: 'fork',

            max_memory_restart: '1G',
            restart_delay: 5000,
            max_restarts: 10,

            cron_restart: '*/15 * * * *',

            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            },

            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: './logs/error.log',
            out_file: './logs/out.log',
            merge_logs: true,

            watch: false,
            ignore_watch: ['node_modules', '.git', 'logs'],

            kill_timeout: 10000,
            wait_ready: true,
            listen_timeout: 10000,

            node_args: [
                '--max-old-space-size=1024',
            ],
        },
        {
            name: 'ai-title-api',
            cwd: '/home/ubuntu/AI_Powered_Video_Title_Generator',
            script: '/home/ubuntu/AI_Powered_Video_Title_Generator/venv/bin/uvicorn',
            args: 'app.main:app --host 127.0.0.1 --port 8000 --workers 1',
            interpreter: 'none',
            instances: 1,
            exec_mode: 'fork',

            max_memory_restart: '2G',
            restart_delay: 5000,
            max_restarts: 10,

            env: {
                PATH: '/home/ubuntu/AI_Powered_Video_Title_Generator/venv/bin:/usr/bin:/bin',
            },

            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: '/home/ubuntu/AI_Powered_Video_Title_Generator/logs/error.log',
            out_file: '/home/ubuntu/AI_Powered_Video_Title_Generator/logs/out.log',
            merge_logs: true,

            watch: false,
            kill_timeout: 300000,  // 5 min for long video processing
        },
    ],
};
