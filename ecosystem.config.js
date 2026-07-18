module.exports = {
  apps: [
    {
      name: 'savdo24',
      script: 'dist/server.cjs',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'telegram-bot',
      script: 'telegram-bot/index.ts',
      interpreter: './node_modules/.bin/tsx',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
};
