// PM2 process for the VPS (see DEPLOY.md). Start with:
//   pm2 start ecosystem.config.cjs && pm2 save
//
// Listens on 127.0.0.1 only: Nginx is the public entry point (HTTPS), so the
// app port is never reachable from outside. Change PORT here and in
// deploy/nginx/stock-rsbb.conf together if 3010 is taken on the VPS.
const PORT = 3010;

module.exports = {
  apps: [
    {
      name: "stock-rsbb",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: `start -H 127.0.0.1 -p ${PORT}`,
      env: { NODE_ENV: "production" },
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "600M",
      time: true, // timestamps in `pm2 logs`
    },
  ],
};
