const registerHandlers = (server, RUN_ID) => {
  // client.createRun()
  server.on({
    method: 'POST',
    path: '/api/reporter',
    reply: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        uid: RUN_ID,
        url: `http://127.0.0.1:3000/projects/test-project/runs/${RUN_ID}/report`,
      }),
    },
  });

  // client.updateRunStatus()
  server.on({
    method: 'PUT',
    path: `/api/reporter/${RUN_ID}`,
    reply: {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  });

  // client.addTestRun()
  server.on({
    method: 'POST',
    path: `/api/reporter/${RUN_ID}/testrun`,
    reply: {
      status: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Test could not be matched' }),
    },
  });
};

module.exports = {
  registerHandlers,
};
