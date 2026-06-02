const path = require('path');
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 6060;

// Middleware para parsear JSON en las peticiones HTTP
app.use(express.json());

// Servimos archivos estáticos de la interfaz
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// RUTAS HTTP PARA AUTENTICACIÓN
// ============================================

// Ruta para registrar un nuevo usuario
app.post('/api/register', async (req, res) => {
  const { username, password, avatar, color } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Usuario y contraseña son requeridos' });
  }

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ success: false, error: 'El usuario debe tener entre 3 y 20 caracteres' });
  }

  if (password.length < 4) {
    return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 4 caracteres' });
  }

  const result = await db.registerUser({ username, password, avatar, color });
  
  if (result.success) {
    // Crear sesión automáticamente después del registro
    const sessionResult = await db.createSession({ userId: result.user.id });
    return res.json({ 
      success: true, 
      user: result.user,
      sessionToken: sessionResult.token
    });
  } else {
    return res.status(400).json(result);
  }
});

// Ruta para iniciar sesión
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Usuario y contraseña son requeridos' });
  }

  const result = await db.loginUser({ username, password });
  
  if (result.success) {
    // Crear sesión para reconexión automática
    const sessionResult = await db.createSession({ userId: result.user.id });
    return res.json({ 
      success: true, 
      user: result.user,
      sessionToken: sessionResult.token
    });
  } else {
    return res.status(401).json(result);
  }
});

// Ruta para validar sesión existente (reconexión automática)
app.post('/api/validate-session', async (req, res) => {
  const { sessionToken } = req.body;

  if (!sessionToken) {
    return res.status(400).json({ success: false, error: 'Token de sesión requerido' });
  }

  const result = await db.validateSession({ sessionToken });
  
  if (result.success) {
    return res.json(result);
  } else {
    return res.status(401).json(result);
  }
});

// Ruta para cerrar sesión
app.post('/api/logout', async (req, res) => {
  const { sessionToken } = req.body;

  if (sessionToken) {
    await db.logoutSession({ sessionToken });
  }

  return res.json({ success: true });
});

// Ruta para actualizar perfil
app.post('/api/update-profile', async (req, res) => {
  const { userId, avatar, color } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'ID de usuario requerido' });
  }

  const result = await db.updateUserProfile({ userId, avatar, color });
  return res.json(result);
});

// Ruta para obtener canales
app.get('/api/channels', async (req, res) => {
  const channels = await db.getChannels();
  return res.json({ success: true, channels });
});

// Ruta para crear un canal
app.post('/api/channels', async (req, res) => {
  const { channel_id, name, description, created_by } = req.body;

  if (!channel_id || !name) {
    return res.status(400).json({ success: false, error: 'ID y nombre del canal son requeridos' });
  }

  const result = await db.createChannel({ channel_id, name, description, created_by });
  return res.json(result);
});

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
  const seenIds = new Set();

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.authenticated) {
      // Usar sessionId para temporales, userId para autenticados
      const uniqueId = client.isTemporary ? client.sessionId : client.userId?.toString();
      const displayName = client.isTemporary ? client.displayName : client.username;
      
      if (uniqueId && !seenIds.has(uniqueId)) {
        seenIds.add(uniqueId);
        users.push({
          sessionId: uniqueId, // Mantener compatibilidad con frontend
          userId: client.userId,
          displayName: displayName,
          username: displayName,
          avatar: client.avatar,
          color: client.color,
          status: 'online',
          isTemporary: client.isTemporary
        });
      }
    }
  }
  return users;
}

wss.on('connection', (socket) => {
  // Valores iniciales - soporta usuarios temporales Y autenticados
  socket.userId = null;
  socket.sessionId = null; // Para usuarios temporales
  socket.username = null;
  socket.displayName = 'Invitado';
  socket.avatar = 'avatar1';
  socket.color = '#5865f2';
  socket.authenticated = false;
  socket.isTemporary = false; // Flag para usuarios temporales

  socket.on('message', async (rawMessage) => {
    let data;
    try {
      data = JSON.parse(rawMessage.toString());
    } catch {
      sendToClient(socket, { type: 'error', text: 'El mensaje debe ser un JSON válido.' });
      return;
    }

    // 1. EVENTO AUTH: Autenticar usuario registrado con su ID de usuario
    if (data.type === 'auth') {
      const user = await db.getUserById(data.userId);
      
      if (!user) {
        sendToClient(socket, { type: 'error', text: 'Usuario no encontrado' });
        return;
      }

      socket.userId = user.id;
      socket.username = user.username;
      socket.displayName = user.username;
      socket.avatar = user.avatar;
      socket.color = user.color;
      socket.authenticated = true;
      socket.isTemporary = false;

      // Enviamos confirmación al cliente
      sendToClient(socket, {
        type: 'authenticated',
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          color: user.color
        },
        isDbConnected: db.isDbConnected()
      });

      // Notificar a todos que este usuario se conectó
      broadcast({
        type: 'system',
        channelId: 'general',
        text: `**${user.username}** se unió al chat.`
      });

      // Enviamos a todos la lista actualizada de usuarios activos
      broadcast({
        type: 'user_list',
        users: getActiveUsersList()
      });
      return;
    }

    // 2. EVENTO JOIN: Para usuarios temporales (sin autenticación)
    if (data.type === 'join') {
      const isReconnection = !!socket.sessionId;
      const previousName = socket.displayName;

      socket.sessionId = data.sessionId;
      socket.displayName = typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 20) : `Invitado_${data.sessionId.slice(-4)}`;
      socket.avatar = data.avatar || 'avatar1';
      socket.color = data.color || '#5865f2';
      socket.isTemporary = true;
      socket.authenticated = true; // Permitir acceso temporal

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

    // Asegurar que el usuario esté autenticado (temporal o registrado) antes de procesar otros eventos
    if (!socket.authenticated) {
      sendToClient(socket, { type: 'error', text: 'Debes autenticarte primero' });
      return;
    }

    // 3. EVENTO GET_HISTORY: Carga y envía el historial de un canal o chat privado (DM)
    if (data.type === 'get_history') {
      const senderId = socket.isTemporary ? socket.sessionId : socket.userId;
      
      const history = await db.getHistory({
        channel_id: data.channelId,
        sender_id: senderId,
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

    // 4. EVENTO MESSAGE: Envía un mensaje (a un canal o en privado 1:1)
    if (data.type === 'message') {
      const text = typeof data.text === 'string' ? data.text.trim() : '';
      if (!text) return;

      // Usar sessionId para temporales, userId para autenticados
      const senderId = socket.isTemporary ? socket.sessionId : socket.userId.toString();
      const senderName = socket.isTemporary ? socket.displayName : socket.username;

      // Guardamos el mensaje en base de datos o en memoria
      const savedMsg = await db.saveMessage({
        channel_id: data.channelId,
        sender_id: senderId,
        sender_name: senderName,
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
          if (client.readyState === WebSocket.OPEN) {
            const clientId = client.isTemporary ? client.sessionId : client.userId?.toString();
            const targetId = socket.isTemporary ? socket.sessionId : socket.userId?.toString();
            
            if (clientId === data.recipientId || clientId === targetId) {
              sendToClient(client, {
                type: 'message',
                recipientId: data.recipientId,
                senderId: senderId,
                message: savedMsg
              });
            }
          }
        }
      }
      return;
    }

    // 5. EVENTO TYPING: Notifica en tiempo real quién está escribiendo
    if (data.type === 'typing') {
      const senderId = socket.isTemporary ? socket.sessionId : socket.userId?.toString();
      const senderName = socket.isTemporary ? socket.displayName : socket.username;
      
      if (data.channelId) {
        // Escritura en Canal: Avisar a todos los del canal excepto al remitente
        broadcast({
          type: 'typing',
          channelId: data.channelId,
          senderId: senderId,
          senderName: senderName,
          isTyping: data.isTyping
        }, socket);
      } else if (data.recipientId) {
        // Escritura en DM: Avisar solo al destinatario
        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN && client !== socket) {
            const clientId = client.isTemporary ? client.sessionId : client.userId?.toString();
            if (clientId === data.recipientId) {
              sendToClient(client, {
                type: 'typing',
                recipientId: senderId,
                senderName: senderName,
                isTyping: data.isTyping
              });
            }
          }
        }
      }
      return;
    }

    // 6. EVENTO UPDATE_PROFILE: Actualizar avatar y color del usuario
    if (data.type === 'update_profile') {
      socket.avatar = data.avatar;
      socket.color = data.color;
      
      // Si es usuario registrado, actualizar en BD
      if (!socket.isTemporary && socket.userId) {
        const result = await db.updateUserProfile({
          userId: socket.userId,
          avatar: data.avatar,
          color: data.color
        });

        if (result.success) {
          sendToClient(socket, {
            type: 'profile_updated',
            user: result.user
          });
        }
      } else {
        // Usuario temporal, solo confirmar
        sendToClient(socket, {
          type: 'profile_updated',
          user: {
            avatar: socket.avatar,
            color: socket.color
          }
        });
      }

      // Notificar a todos la lista actualizada
      broadcast({
        type: 'user_list',
        users: getActiveUsersList()
      });
      return;
    }
  });

  socket.on('close', () => {
    // Si el usuario estaba autenticado, enviamos aviso
    if (socket.authenticated) {
      const uniqueId = socket.isTemporary ? socket.sessionId : socket.userId?.toString();
      const displayName = socket.isTemporary ? socket.displayName : socket.username;
      
      // Verificamos si al usuario le queda alguna otra pestaña abierta en el servidor
      const isStillConnected = Array.from(wss.clients).some((client) => {
        if (client === socket || client.readyState !== WebSocket.OPEN) return false;
        const clientId = client.isTemporary ? client.sessionId : client.userId?.toString();
        return clientId === uniqueId;
      });

      if (!isStillConnected && displayName) {
        broadcast({
          type: 'system',
          channelId: 'general',
          text: `**${displayName}** salió del chat.`
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
