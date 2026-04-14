const crypto = require('crypto');

function generateCTag(tasks = []) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    const timestamp = Date.now();
    return `"ctag-${timestamp}"`;
  }

  const latestUpdate = tasks.reduce((latest, task) => {
    const taskTime = new Date(task.updated_at || task.created_at).getTime();
    return Math.max(latest, taskTime);
  }, 0);

  const taskIds = tasks.map(t => t.id).sort().join(',');
  const hash = crypto
    .createHash('md5')
    .update(`${latestUpdate}-${taskIds}`)
    .digest('hex')
    .substring(0, 8);

  return `"ctag-${latestUpdate}-${hash}"`;
}

function parseCTag(ctagHeader) {
  if (!ctagHeader) {
    return null;
  }

  return ctagHeader.replace(/^["']|["']$/g, '');
}

module.exports = {
  generateCTag,
  parseCTag
};
