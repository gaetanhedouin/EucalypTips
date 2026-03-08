import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 4100);

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', service: 'site-api-skeleton', timestamp: new Date().toISOString() }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(port, () => {
  console.log(`[site-api] listening on http://localhost:${port}`);
});
