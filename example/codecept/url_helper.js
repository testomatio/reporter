const Helper = require('@codeceptjs/helper');

// stands in for a browser helper to test reporting the url of a failed test
class UrlHelper extends Helper {
  async grabCurrentUrl() {
    return 'http://localhost:8000/failed-page';
  }
}

module.exports = UrlHelper;
