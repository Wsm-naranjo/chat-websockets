const path = require('path');
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 6060;

// Servimos archivos estáticos de la interfaz
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar la base de datos (con fallback automático a memoria)
db.initDatabase();

// Función auxiliar para enviar datos en JSON a un cliente específico
function sendToClient(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

// Función para enviar datos a todos los clientes conectados (con opción de excluir a uno)
function broadcast(payload, exceptSocket = null) {
  const message = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client !== exceptSocket) {
      client.send(message);
    }
  }
}

// Genera una lista única de usuarios en línea (sin duplicar si abren varias pestañas)
function getActiveUsersList() {
  const users = [];
  const seenSessions = new Set();

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.sessionId) {
      if (!seenSessions.has(client.sessionId)) {
        seenSessions.add(client.sessionId);
        users.push({
          sessionId: client.sessionId,
          displayName: client.displayName,
          avatar: client.avatar,
          color: client.color,
          status: 'online'
        });
      }
    }
  }
  return users;
}

wss.on('connection', (socket) => {
  // Valores iniciales por defecto antes de recibir el evento 'join'
  socket.sessionId = null;
  socket.displayName = 'Invitado';
  socket.avatar = 'avatar1';
  socket.color = '#5865f2';

  socket.on('message', async (rawMessage) => {
    let data;
    try {
      data = JSON.parse(rawMessage.toString());
    } catch {
      sendToClient(socket, { type: 'error', text: 'El mensaje debe ser un JSON válido.' });
      return;
    }

    // 1. EVENTO JOIN: Registra o reconecta a un usuario con su ID único de sesión
    if (data.type === 'join') {
      const isReconnection = !!socket.sessionId;
      const previousName = socket.displayName;

      socket.sessionId = data.sessionId;
      socket.displayName = typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 20) : `Invitado_${data.sessionId.slice(-4)}`;
      socket.avatar = data.avatar || 'avatar1';
      socket.color = data.color || '#5865f2';

      // Enviamos confirmación al cliente
      sendToClient(socket, {
        type: 'joined',
        sessionId: socket.sessionId,
        displayName: socket.displayName,
        avatar: socket.avatar,
        color: socket.color,
        isDbConnected: db.isDbConnected()
      });

      // Si cambió de nombre o es una conexión nueva, notificamos en el canal general
      if (isReconnection && previousName !== socket.displayName) {
        broadcast({
          type: 'system',
          channelId: 'general',
          text: `**${previousName}** ahora se llama **${socket.displayName}**.`
        });
      } else if (!isReconnection) {
        broadcast({
          type: 'system',
          channelId: 'general',
          text: `**${socket.displayName}** se unió al chat.`
        });
      }

      // Enviamos a todos la lista actualizada de usuarios activos
      broadcast({
        type: 'user_list',
        users: getActiveUsersList()
      });
      return;
    }

    // Asegurar que el usuario se haya registrado con 'join' antes de procesar otros eventos
    if (!socket.sessionId) {
      return;
    }

    // 2. EVENTO GET_HISTORY: Carga y envía el historial de un canal o chat privado (DM)
    if (data.type === 'get_history') {
      const history = await db.getHistory({
        channel_id: data.channelId,
        sender_id: socket.sessionId,
        recipient_id: data.recipientId
      });

      sendToClient(socket, {
        type: 'history',
        channelId: data.channelId || null,
        recipientId: data.recipientId || null,
        messages: history
      });
      return;
    }

    // 3. EVENTO MESSAGE: Envía un mensaje (a un canal o en privado 1:1)
    if (data.type === 'message') {
      const text = typeof data.text === 'string' ? data.text.trim() : '';
      if (!text) return;

      // Guardamos el mensaje en base de datos o en memoria
      const savedMsg = await db.saveMessage({
        channel_id: data.channelId,
        sender_id: socket.sessionId,
        sender_name: socket.displayName,
        sender_avatar: socket.avatar,
        sender_color: socket.color,
        recipient_id: data.recipientId,
        text,
        type: 'message'
      });

      if (data.channelId) {
        // Mensaje público de Canal: Difusión a todos
        broadcast({
          type: 'message',
          channelId: data.channelId,
          message: savedMsg
        });
      } else if (data.recipientId) {
        // Mensaje Privado (DM): Solo para el remitente y destinatario
        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN &&
            (client.sessionId === data.recipientId || client.sessionId === socket.sessionId)) {
            sendToClient(client, {
              type: 'message',
              recipientId: data.recipientId,
              senderId: socket.sessionId,
              message: savedMsg
            });
          }
        }
      }
      return;
    }

    // 4. EVENTO TYPING: Notifica en tiempo real quién está escribiendo
    if (data.type === 'typing') {
      if (data.channelId) {
        // Escritura en Canal: Avisar a todos los del canal excepto al remitente
        broadcast({
          type: 'typing',
          channelId: data.channelId,
          senderId: socket.sessionId,
          senderName: socket.displayName,
          isTyping: data.isTyping
        }, socket);
      } else if (data.recipientId) {
        // Escritura en DM: Avisar solo al destinatario
        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN && client.sessionId === data.recipientId && client !== socket) {
            sendToClient(client, {
              type: 'typing',
              recipientId: socket.sessionId, // indica que esta persona nos escribe a nosotros
              senderName: socket.displayName,
              isTyping: data.isTyping
            });
          }
        }
      }
      return;
    }
  });

  socket.on('close', () => {
    // Si la sesión del socket estaba registrada, enviamos aviso
    if (socket.sessionId) {
      // Verificamos si al usuario le queda alguna otra pestaña abierta en el servidor
      const isStillConnected = Array.from(wss.clients).some(
        (client) => client !== socket && client.readyState === WebSocket.OPEN && client.sessionId === socket.sessionId
      );

      if (!isStillConnected) {
        broadcast({
          type: 'system',
          channelId: 'general',
          text: `**${socket.displayName}** salió del chat.`
        });
      }
    }

    // Enviamos la lista actualizada de usuarios activos a todos
    broadcast({
      type: 'user_list',
      users: getActiveUsersList()
    });
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor listo y corriendo en http://localhost:${PORT}`);
});
