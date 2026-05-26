var spawn = require('child_process').spawn;
var child = spawn(
  '/Users/indevvermini/.nvm/versions/node/v22.2.0/bin/node',
  ['/Users/indevvermini/claude/sunday-musician/node_modules/.bin/next', 'dev', '--port', '3000'],
  {
    cwd: '/Users/indevvermini/claude/sunday-musician',
    stdio: 'inherit'
  }
);
child.on('exit', function(code) { process.exit(code || 0); });
process.on('SIGTERM', function() { child.kill('SIGTERM'); });
process.on('SIGINT', function() { child.kill('SIGINT'); });
