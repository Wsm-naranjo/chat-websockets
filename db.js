require('dotenv').config();
const { Pool } = require('pg');

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

// Inicialización de la base de datos
async function initDatabase() {
  try {
    pool = new Pool(dbConfig);
    // Probamos la conexión con una consulta simple
    await pool.query('SELECT NOW()');
    dbConnected = true;
    console.log('[Base de Datos] Conectado exitosamente a PostgreSQL local.');

    // Crear la tabla de mensajes si no existe
    const createTableQuery = `
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
      
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient ON messages(sender_id, recipient_id);
    `;
    await pool.query(createTableQuery);
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

module.exports = {
  initDatabase,
  saveMessage,
  getHistory,
  isDbConnected: () => dbConnected
};
