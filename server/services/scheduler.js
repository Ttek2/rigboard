// Central scheduler — re-exports the individual schedulers for clean startup
const { startFeedScheduler } = require('./feedParser');
const { startHealthChecker } = require('./healthChecker');

function startAll(db) {
  startFeedScheduler(db);
  startHealthChecker(db);
}

module.exports = { startAll };
