// PM2 config for HintTalk (Option 2 alternative: PM2-managed Node.js process)
//
// Run from the extracted release folder (contains server.mjs + dist/):
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save && pm2 startup   # auto-start on boot
//
// Check:
//   pm2 status hinttalk
//   pm2 logs hinttalk

const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'hinttalk',
      script: path.join(__dirname, '..', 'server.mjs'),
      cwd: path.join(__dirname, '..'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      kill_timeout: 12000, // > 10s grace period in server.mjs shutdown
      env: {
        NODE_ENV: 'production',
        PORT: 21079,
      },
    },
  ],
};
