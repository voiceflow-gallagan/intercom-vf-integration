module.exports = {
  apps: [
    {
      name: 'integration-intercom',
      script: 'app.js',
      env_production: {
        PORT: 4242,
        NODE_ENV: 'production',
      },
      watch: false,
    },
  ],
}
