import { WebSocketServer } from 'ws';
import { createServer } from 'http';
const server = createServer();
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  console.log('UPGRADE req path:', req.url);
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});
wss.on('connection', (ws) => console.log('CONNECTED'));
server.listen(3999, () => console.log('test server on 3999'));
