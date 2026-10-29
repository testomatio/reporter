import http from 'node:http';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('./public/index.html', import.meta.url));
const port = Number(process.env.PORT || 3000);

http
  .createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  })
  .listen(port, '127.0.0.1');
