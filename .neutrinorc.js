const react = require('@neutrinojs/react');

module.exports = {
  options: {
    source: 'src/ui',
    root: __dirname,
  },
  use: [
    react({
      html: {
        title: 'Provisioning Simulator'
      }
    }),
  ],
};
