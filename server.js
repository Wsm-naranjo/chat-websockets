const path = require('path');
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;
let nextClientId = 1;

app.use(express.static(path.join(__dirname, 'public')));

function broadcast(payload, exceptSocket = null) {
  const message = JSON.stringify(payload);

  // ws no trae un sistema de salas ni de eventos por grupo: recorremos los sockets activos y enviamos el mismo mensaje a todos.
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client !== exceptSocket) {
      client.send(message);
    }
  }
}

function sendToClient(socket, payload) {
  // Antes de enviar, comprobamos que el socket siga abierto para evitar errores si el navegador ya se cerró.
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

wss.on('connection', (socket) => {
  // Cada conexión nueva recibe un nombre provisional para que el chat funcione aunque el usuario no escriba uno.
  const clientId = nextClientId++;
  socket.clientId = clientId;
  socket.displayName = `Invitado ${clientId}`;

  sendToClient(socket, {
    type: 'system',
    text: `Conectado como ${socket.displayName}.`
  });

  broadcast(
    {
      type: 'system',
      text: `${socket.displayName} se unió al chat.`
    },
    socket
  );

  socket.on('message', (rawMessage) => {
    let data;

    try {
      // El navegador manda texto o bytes; lo convertimos a objeto para poder leer type, name y text.
      data = JSON.parse(rawMessage.toString());
    } catch {
      sendToClient(socket, {
        type: 'system',
        text: 'Mensaje inválido. El cliente debe enviar JSON.'
      });
      return;
    }

    if (data.type === 'join') {
      const newName = typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 20) : socket.displayName;
      const previousName = socket.displayName;
      socket.displayName = newName;

      // Avisamos a todos que el usuario cambió de nombre para que el chat quede sincronizado.
      broadcast({
        type: 'system',
        text: `${previousName} ahora se llama ${socket.displayName}.`
      });
      return;
    }

    if (data.type === 'message') {
      const text = typeof data.text === 'string' ? data.text.trim() : '';
      if (!text) {
        return;
      }

      broadcast({
        type: 'message',
        from: socket.displayName,
        text,
        time: new Date().toLocaleTimeString()
      });
    }
  });

  socket.on('close', () => {
    // close se dispara al cerrar la pestaña o al perder la conexión.
    broadcast({
      type: 'system',
      text: `${socket.displayName} salió del chat.`
    });
  });
});

server.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});
