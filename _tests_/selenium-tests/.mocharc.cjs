module.exports = {
  reporter: 'mochawesome',
  reporterOptions: {
    reportDir: 'reports',
    reportFilename: 'mochawesome',
    quiet: true,
    json: true,
    html: true
  },
  spec: ['specs/**/*.spec.js'],
  timeout: 30000
};
