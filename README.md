# 💬 SpaceChat - Chat en Tiempo Real con Autenticación

Sistema de chat en tiempo real con WebSockets, autenticación de usuarios y persistencia en PostgreSQL.

## ✨ Características

- 🔐 **Sistema de autenticación completo** (registro, login, sesiones persistentes)
- 💬 **Chat en tiempo real** con WebSockets
- 📱 **Canales públicos** estilo Discord
- 💌 **Mensajes directos (DMs)** estilo WhatsApp
- 💾 **Persistencia en PostgreSQL** (con fallback a memoria)
- 👥 **Lista de usuarios en línea**
- ✍️ **Indicadores de escritura** en tiempo real
- 😀 **Selector de emojis y GIFs**
- 🎨 **Personalización** (avatar y color de acento)
- 🔄 **Reconexión automática**

## 🛠️ Tecnologías Utilizadas

- **Backend:** Node.js, Express, WebSocket (ws)
- **Base de Datos:** PostgreSQL
- **Frontend:** Vue.js 3, HTML5, CSS3
- **Seguridad:** bcrypt (hasheo de contraseñas)
- **Otros:** dotenv (variables de entorno)

## 📋 Requisitos Previos

- Node.js (v14 o superior)
- PostgreSQL (v12 o superior)
- npm o yarn

## 🚀 Instalación

### 1. Clonar o descargar el proyecto

```bash
cd chat-websockets
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar PostgreSQL

**Opción A: Crear la base de datos manualmente**

```sql
-- Conectarse a PostgreSQL
psql -U postgres

-- Crear la base de datos
CREATE DATABASE chat_websockets;

-- Salir
\q
```

**Opción B: Usar Laragon (si lo tienes instalado)**

Laragon ya incluye PostgreSQL. Solo asegúrate de que esté corriendo.

### 4. Configurar variables de entorno

Edita el archivo `.env` con tus credenciales de PostgreSQL:

```env
DB_USER=postgres
DB_PASSWORD=tu_contraseña_aqui
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=chat_websockets
PORT=6060
```

### 5. Iniciar el servidor

```bash
npm start
```

Deberías ver:

```
[Base de Datos] Conectado exitosamente a PostgreSQL local.
[Base de Datos] Estructura de tablas verificada/creada correctamente.
🚀 Servidor listo y corriendo en http://localhost:6060
```

### 6. Abrir en el navegador

Visita: `http://localhost:6060`

## 📖 Cómo Usar

### Primera Vez (Registro)

1. Abre `http://localhost:6060`
2. Serás redirigido a la pantalla de autenticación
3. Haz clic en "Registrarse"
4. Completa el formulario:
   - Nombre de usuario (3-20 caracteres)
   - Contraseña (mínimo 4 caracteres)
   - Confirma la contraseña
   - Elige un avatar (emoji)
   - Elige un color de acento
5. Haz clic en "Crear Cuenta"
6. Serás redirigido automáticamente al chat

### Usuarios Existentes (Login)

1. Abre `http://localhost:6060`
2. Ingresa tu usuario y contraseña
3. Haz clic en "Iniciar Sesión"
4. Entrarás directamente al chat

### Reconexión Automática

Si cierras el navegador y vuelves a entrar, tu sesión se mantendrá activa por 30 días. No necesitarás volver a iniciar sesión.

### Chatear

**Canales Públicos:**
- Haz clic en un canal del panel izquierdo (#general, #gaming, etc.)
- Escribe tu mensaje en el input inferior
- Presiona Enter o haz clic en el botón de enviar
- Todos los usuarios verán tu mensaje

**Mensajes Directos (DMs):**
- Haz clic en un usuario de la lista "Mensajes Directos"
- Escribe tu mensaje
- Solo tú y ese usuario verán la conversación

**Emojis y GIFs:**
- Haz clic en el botón 😀 para abrir el selector de emojis
- Haz clic en el botón "GIF" para buscar GIFs
- Selecciona uno y se enviará automáticamente

**Personalizar Perfil:**
- Haz clic en tu avatar en la parte superior izquierda
- Cambia tu avatar o color
- Haz clic en "Guardar"

## 📁 Estructura del Proyecto

```
chat-websockets/
├── server.js              # Servidor principal (HTTP + WebSocket + API REST)
├── db.js                  # Módulo de base de datos y autenticación
├── package.json           # Dependencias del proyecto
├── .env                   # Variables de entorno (configuración)
├── public/
│   ├── index.html         # Interfaz principal del chat
│   ├── auth.html          # Pantalla de login/registro
│   ├── app.js             # Lógica del cliente (Vue.js)
│   ├── auth-check.js      # Verificación de sesión
│   └── styles.css         # Estilos CSS
├── README.md              # Este archivo
```

## 🗄️ Base de Datos

El proyecto crea automáticamente 2 tablas:

### `sessions` - Sesiones activas
- `id`: Identificador único
- `user_id`: Referencia al usuario
- `session_token`: Token de 64 caracteres
- `created_at`: Fecha de creación
- `expires_at`: Fecha de expiración (30 días)

### `messages` - Historial de mensajes
- `id`: Identificador único
- `channel_id`: Canal donde se envió (o NULL si es DM)
- `sender_id`: ID del usuario que envió
- `sender_name`: Nombre del usuario
- `sender_avatar`: Avatar del usuario
- `sender_color`: Color del usuario
- `recipient_id`: ID del destinatario (solo para DMs)
- `text`: Contenido del mensaje
- `type`: Tipo ('message' o 'system')
- `created_at`: Timestamp del mensaje


```



---

**¿Necesitas ayuda?** Consulta la [Guía Técnica](./GUIA_TECNICA.md) para explicaciones detalladas.
