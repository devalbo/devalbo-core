const path = require('path');

module.exports = {
  terminal: {
    import: [path.join(__dirname, 'test-steps/terminal/greet.steps.js')],
    format: [
      'progress',
      'json:test-results/bdd/terminal/latest/cucumber-report.json',
      'html:test-results/bdd/terminal/latest/cucumber-report.html'
    ],
    formatOptions: {
      snippetInterface: 'async-await'
    }
  },
  browser: {
    import: [path.join(__dirname, 'test-steps/browser/greet.steps.js')],
    format: [
      'progress',
      'json:test-results/bdd/browser/latest/cucumber-report.json',
      'html:test-results/bdd/browser/latest/cucumber-report.html'
    ],
    formatOptions: {
      snippetInterface: 'async-await'
    }
  }
};
