function handleOptions(req, res) {
  const isCalendarCollection = req.path.includes('/tasks/');

  const davMethods = [
    'OPTIONS',
    'GET',
    'HEAD',
    'PUT',
    'DELETE',
    'PROPFIND',
    'REPORT'
  ];

  const davCapabilities = [
    '1',
    '2',
    '3',
    'calendar-access',
    'calendar-schedule'
  ];

  res.set({
    'DAV': davCapabilities.join(', '),
    'Allow': davMethods.join(', '),
    'MS-Author-Via': 'DAV',
    'Accept-Ranges': 'none',
    'Content-Length': '0'
  });

  if (isCalendarCollection) {
    res.set({
      'Content-Type': 'text/calendar; charset=utf-8'
    });
  }

  res.status(204).end();
}

module.exports = {
  handleOptions
};
