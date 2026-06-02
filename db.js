require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Configuración de la base de datos desde el archivo .env
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_DATABASE || 'chat_websockets',
};

let pool = null;
let dbConnected = false;

// Fallback en memoria RAM por si PostgreSQL no está disponible
const memoryMessages = [];
const memoryUsers = []; // Usuarios en memoria como fallback

// Inicialización de la base de datos
async function initDatabase() {
  try {
    pool = new Pool(dbConfig);
    // Probamos la conexión con una consulta simple
    await pool.query('SELECT NOW()');
    dbConnected = true;
    console.log('[Base de Datos] Conectado exitosamente a PostgreSQL local.');

    // Crear las tablas si no existen
    const createTablesQuery = `
      -- Tabla de usuarios registrados
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar VARCHAR(100) DEFAULT 'avatar1',
        color VARCHAR(20) DEFAULT '#5865f2',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );
      
      -- Tabla de sesiones activas (para reconexión automática)
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );
      
      -- Tabla de canales públicos
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        channel_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_default BOOLEAN DEFAULT FALSE
      );
      
      -- Tabla de mensajes (compatible con usuarios registrados y temporales)
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        channel_id VARCHAR(50),
        sender_id VARCHAR(100) NOT NULL,
        sender_name VARCHAR(100) NOT NULL,
        sender_avatar VARCHAR(100),
        sender_color VARCHAR(20),
        recipient_id VARCHAR(100),
        text TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'message',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Índices para optimizar consultas
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient ON messages(sender_id, recipient_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_channels_channel_id ON channels(channel_id);
    `;
    await pool.query(createTablesQuery);
    
    // Insertar canales por defecto si no existen
    const defaultChannels = [
      { channel_id: 'general', name: 'general', description: 'Canal general del servidor. ¡Bienvenido!', is_default: true },
      { channel_id: 'gaming', name: 'gaming', description: 'Para hablar de videojuegos, consolas y más.', is_default: true },
      { channel_id: 'memes', name: 'memes', description: 'Comparte imágenes graciosas, enlaces y risas.', is_default: true },
      { channel_id: 'tecnologia', name: 'tecnología', description: 'Canal de programadores, gadgets y hardware.', is_default: true }
    ];
    
    for (const channel of defaultChannels) {
      await pool.query(`
        INSERT INTO channels (channel_id, name, description, is_default)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (channel_id) DO NOTHING
      `, [channel.channel_id, channel.name, channel.description, channel.is_default]);
    }
    
    console.log('[Base de Datos] Estructura de tablas verificada/creada correctamente.');
  } catch (error) {
    dbConnected = false;
    pool = null;
    console.warn('⚠️ [Base de Datos] ADVERTENCIA: No se pudo conectar a PostgreSQL local.');
    console.warn(`Detalle del error: ${error.message}`);
    console.info('👉 El chat funcionará en Modo Fallback (almacenamiento en memoria temporal RAM).');
  }
}

// Guardar un mensaje (en PostgreSQL o en Memoria)
async function saveMessage({ channel_id, sender_id, sender_name, sender_avatar, sender_color, recipient_id, text, type }) {
  const messageData = {
    channel_id: channel_id || null,
    sender_id,
    sender_name,
    sender_avatar: sender_avatar || 'avatar1',
    sender_color: sender_color || '#5865f2',
    recipient_id: recipient_id || null,
    text,
    type: type || 'message',
    created_at: new Date()
  };

  if (dbConnected && pool) {
    try {
      const query = `
        INSERT INTO messages 
        (channel_id, sender_id, sender_name, sender_avatar, sender_color, recipient_id, text, type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `;
      const values = [
        messageData.channel_id,
        messageData.sender_id,
        messageData.sender_name,
        messageData.sender_avatar,
        messageData.sender_color,
        messageData.recipient_id,
        messageData.text,
        messageData.type
      ];
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('[Base de Datos] Error al guardar mensaje en Postgres. Guardando en memoria.', error.message);
    }
  }

  // Guardar en memoria (fallback)
  const id = memoryMessages.length + 1;
  const memoryMsg = { id, ...messageData };
  memoryMessages.push(memoryMsg);
  
  // Limitar memoria a los últimos 500 mensajes para evitar fugas de memoria
  if (memoryMessages.length > 500) {
    memoryMessages.shift();
  }
  
  return memoryMsg;
}

// Obtener el historial de mensajes (en PostgreSQL o Memoria)
async function getHistory({ channel_id, sender_id, recipient_id }) {
  if (dbConnected && pool) {
    try {
      if (channel_id) {
        // Historial de un canal público
        const query = `
          SELECT * FROM messages 
          WHERE channel_id = $1 AND recipient_id IS NULL
          ORDER BY created_at ASC 
          LIMIT 50;
        `;
        const result = await pool.query(query, [channel_id]);
        return result.rows;
      } else if (sender_id && recipient_id) {
        // Historial de un chat directo (DM)
        const query = `
          SELECT * FROM messages 
          WHERE (sender_id = $1 AND recipient_id = $2) 
             OR (sender_id = $2 AND recipient_id = $1)
          ORDER BY created_at ASC 
          LIMIT 50;
        `;
        const result = await pool.query(query, [sender_id, recipient_id]);
        return result.rows;
      }
    } catch (error) {
      console.error('[Base de Datos] Error al recuperar historial de Postgres. Usando memoria.', error.message);
    }
  }

  // Historial desde memoria (fallback)
  if (channel_id) {
    return memoryMessages.filter(m => m.channel_id === channel_id && !m.recipient_id);
  } else if (sender_id && recipient_id) {
    return memoryMessages.filter(m => 
      (m.sender_id === sender_id && m.recipient_id === recipient_id) || 
      (m.sender_id === recipient_id && m.recipient_id === sender_id)
    );
  }
  
  return [];
}

// ============================================
// FUNCIONES DE AUTENTICACIÓN Y USUARIOS
// ============================================

// Registrar un nuevo usuario
async function registerUser({ username, password, avatar, color }) {
  const passwordHash = await bcrypt.hash(password, 10);
  
  if (dbConnected && pool) {
    try {
      const query = `
        INSERT INTO users (username, password_hash, avatar, color)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, avatar, color, created_at;
      `;
      const result = await pool.query(query, [username, passwordHash, avatar || 'avatar1', color || '#5865f2']);
      return { success: true, user: result.rows[0] };
    } catch (error) {
      if (error.code === '23505') { // Código de error de PostgreSQL para violación de unicidad
        return { success: false, error: 'El nombre de usuario ya existe' };
      }
      console.error('[Base de Datos] Error al registrar usuario:', error.message);
      return { success: false, error: 'Error al registrar usuario' };
    }
  }

  // Fallback en memoria
  const existingUser = memoryUsers.find(u => u.username === username);
  if (existingUser) {
    return { success: false, error: 'El nombre de usuario ya existe' };
  }

  const newUser = {
    id: memoryUsers.length + 1,
    username,
    password_hash: passwordHash,
    avatar: avatar || 'avatar1',
    color: color || '#5865f2',
    created_at: new Date()
  };
  memoryUsers.push(newUser);
  
  return { 
    success: true, 
    user: { 
      id: newUser.id, 
      username: newUser.username, 
      avatar: newUser.avatar, 
      color: newUser.color,
      created_at: newUser.created_at
    } 
  };
}

// Iniciar sesión (login)
async function loginUser({ username, password }) {
  if (dbConnected && pool) {
    try {
      const query = `
        SELECT id, username, password_hash, avatar, color, created_at
        FROM users
        WHERE username = $1;
      `;
      const result = await pool.query(query, [username]);
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Usuario o contraseña incorrectos' };
      }

      const user = result.rows[0];
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      
      if (!passwordMatch) {
        return { success: false, error: 'Usuario o contraseña incorrectos' };
      }

      // Actualizar último login
      await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

      return { 
        success: true, 
        user: { 
          id: user.id, 
          username: user.username, 
          avatar: user.avatar, 
          color: user.color 
        } 
      };
    } catch (error) {
      console.error('[Base de Datos] Error al iniciar sesión:', error.message);
      return { success: false, error: 'Error al iniciar sesión' };
    }
  }

  // Fallback en memoria
  const user = memoryUsers.find(u => u.username === username);
  if (!user) {
    return { success: false, error: 'Usuario o contraseña incorrectos' };
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    return { success: false, error: 'Usuario o contraseña incorrectos' };
  }

  return { 
    success: true, 
    user: { 
      id: user.id, 
      username: user.username, 
      avatar: user.avatar, 
      color: user.color 
    } 
  };
}

// Crear una sesión (token) para reconexión automática
async function createSession({ userId }) {
  const sessionToken = require('crypto').randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

  if (dbConnected && pool) {
    try {
      const query = `
        INSERT INTO sessions (user_id, session_token, expires_at)
        VALUES ($1, $2, $3)
        RETURNING session_token;
      `;
      const result = await pool.query(query, [userId, sessionToken, expiresAt]);
      return { success: true, token: result.rows[0].session_token };
    } catch (error) {
      console.error('[Base de Datos] Error al crear sesión:', error.message);
      return { success: false, error: 'Error al crear sesión' };
    }
  }

  // En memoria no implementamos sesiones persistentes
  return { success: true, token: sessionToken };
}

// Validar un token de sesión y obtener el usuario
async function validateSession({ sessionToken }) {
  if (dbConnected && pool) {
    try {
      const query = `
        SELECT u.id, u.username, u.avatar, u.color
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token = $1 AND s.expires_at > CURRENT_TIMESTAMP;
      `;
      const result = await pool.query(query, [sessionToken]);
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Sesión inválida o expirada' };
      }

      // Actualizar último login
      await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [result.rows[0].id]);

      return { success: true, user: result.rows[0] };
    } catch (error) {
      console.error('[Base de Datos] Error al validar sesión:', error.message);
      return { success: false, error: 'Error al validar sesión' };
    }
  }

  return { success: false, error: 'Sesiones no disponibles en modo memoria' };
}

// Cerrar sesión (eliminar token)
async function logoutSession({ sessionToken }) {
  if (dbConnected && pool) {
    try {
      await pool.query('DELETE FROM sessions WHERE session_token = $1', [sessionToken]);
      return { success: true };
    } catch (error) {
      console.error('[Base de Datos] Error al cerrar sesión:', error.message);
      return { success: false, error: 'Error al cerrar sesión' };
    }
  }

  return { success: true };
}

// Actualizar perfil de usuario
async function updateUserProfile({ userId, avatar, color }) {
  if (dbConnected && pool) {
    try {
      const query = `
        UPDATE users 
        SET avatar = $1, color = $2
        WHERE id = $3
        RETURNING id, username, avatar, color;
      `;
      const result = await pool.query(query, [avatar, color, userId]);
      return { success: true, user: result.rows[0] };
    } catch (error) {
      console.error('[Base de Datos] Error al actualizar perfil:', error.message);
      return { success: false, error: 'Error al actualizar perfil' };
    }
  }

  // Fallback en memoria
  const user = memoryUsers.find(u => u.id === userId);
  if (user) {
    user.avatar = avatar;
    user.color = color;
    return { 
      success: true, 
      user: { 
        id: user.id, 
        username: user.username, 
        avatar: user.avatar, 
        color: user.color 
      } 
    };
  }

  return { success: false, error: 'Usuario no encontrado' };
}

// Obtener información de un usuario por ID
async function getUserById(userId) {
  if (dbConnected && pool) {
    try {
      const query = 'SELECT id, username, avatar, color FROM users WHERE id = $1';
      const result = await pool.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('[Base de Datos] Error al obtener usuario:', error.message);
      return null;
    }
  }

  // Fallback en memoria
  const user = memoryUsers.find(u => u.id === userId);
  if (user) {
    return { 
      id: user.id, 
      username: user.username, 
      avatar: user.avatar, 
      color: user.color 
    };
  }
  return null;
}

// ============================================
// FUNCIONES DE CANALES
// ============================================

// Obtener todos los canales
async function getChannels() {
  if (dbConnected && pool) {
    try {
      const query = `
        SELECT channel_id, name, description, is_default, created_at
        FROM channels
        ORDER BY is_default DESC, created_at ASC
      `;
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('[Base de Datos] Error al obtener canales:', error.message);
      return [];
    }
  }

  // Fallback: canales por defecto en memoria
  return [
    { channel_id: 'general', name: 'general', description: 'Canal general del servidor. ¡Bienvenido!', is_default: true },
    { channel_id: 'gaming', name: 'gaming', description: 'Para hablar de videojuegos, consolas y más.', is_default: true },
    { channel_id: 'memes', name: 'memes', description: 'Comparte imágenes graciosas, enlaces y risas.', is_default: true },
    { channel_id: 'tecnologia', name: 'tecnología', description: 'Canal de programadores, gadgets y hardware.', is_default: true }
  ];
}

// Crear un nuevo canal
async function createChannel({ channel_id, name, description, created_by }) {
  if (dbConnected && pool) {
    try {
      const query = `
        INSERT INTO channels (channel_id, name, description, created_by, is_default)
        VALUES ($1, $2, $3, $4, FALSE)
        RETURNING channel_id, name, description, created_at;
      `;
      const result = await pool.query(query, [channel_id, name, description, created_by || null]);
      return { success: true, channel: result.rows[0] };
    } catch (error) {
      if (error.code === '23505') {
        return { success: false, error: 'El canal ya existe' };
      }
      console.error('[Base de Datos] Error al crear canal:', error.message);
      return { success: false, error: 'Error al crear canal' };
    }
  }

  return { success: false, error: 'Base de datos no disponible' };
}

module.exports = {
  initDatabase,
  saveMessage,
  getHistory,
  isDbConnected: () => dbConnected,
  // Funciones de autenticación
  registerUser,
  loginUser,
  createSession,
  validateSession,
  logoutSession,
  updateUserProfile,
  getUserById,
  // Funciones de canales
  getChannels,
  createChannel
};
