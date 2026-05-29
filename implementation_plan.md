# Plan de Implementación: Chat WebSockets Premium (Fusión Discord + WhatsApp)

Este plan detalla la evolución del chat básico actual a una aplicación de mensajería de alta gama que fusiona la estructura de canales y estética oscura de **Discord** con la agilidad y las conversaciones privadas directas (DMs) de **WhatsApp**, todo ello integrado de forma opcional con **PostgreSQL** para la persistencia.

---

## User Review Required

> [!IMPORTANT]
> **Arquitectura de Sockets y Persistencia Opcional:**
> Para asegurar que la aplicación funcione inmediatamente en tu entorno, la base de datos de PostgreSQL contará con una **reconexión y fallback automático a memoria**. Si tu PostgreSQL local no está activo o no está configurado, la aplicación funcionará perfectamente usando almacenamiento en memoria RAM, imprimiendo una advertencia clara en la consola para ayudarte a configurarlo.

> [!TIP]
> **Estética del Chat (Híbrido Discord + WhatsApp):**
> - **Estilo Discord:** Interfaz completamente en Modo Oscuro con tonalidades gris azulado, lista de canales con `#` a la izquierda, lista de miembros activos en el lateral derecho (con opción de ocultarla) y flujo de mensajes cronológico con avatares de colores.
> - **Estilo WhatsApp:** Sección de "Mensajes Directos" en la barra lateral. Al hacer clic en cualquier usuario activo en la red, se abrirá un chat privado temporal 1:1 en tiempo real con él.

---

## Open Questions

Ninguna de momento. Si deseas cambiar alguna configuración de colores, agregar canales por defecto específicos o modificar la base de datos, puedes comentarlo en tu feedback de este plan.

---

## Proposed Changes

### Backend (Servidor)

Añadiremos soporte para canales, mensajes privados (DMs), estados de escritura, avatares personalizables e integración con base de datos PostgreSQL.

#### [MODIFY] [server.js](file:///c:/laragon/www/chat-websockets/server.js)
- Implementar soporte para múltiples canales (`#general`, `#gaming`, `#memes`, `#tecnologia`).
- Rastrear clientes activos con ID único, nombre, avatar y color de perfil.
- Implementar eventos de socket:
  - `join`: Actualiza perfil y envía historial inicial.
  - `message`: Envía mensaje a canal o DM privado a otro usuario.
  - `typing`: Informa a otros quién está escribiendo en el canal/DM activo.
  - `user_list`: Notifica a todos los clientes la lista completa de usuarios conectados y sus estados.
- Integrar con PostgreSQL (`pg`):
  - Crear tabla `messages` si no existe (`id`, `channel_id`, `sender_name`, `sender_avatar`, `sender_color`, `recipient_id`, `text`, `type`, `created_at`).
  - Cargar el historial del canal o DM al conectar.
  - Fallback a memoria si la base de datos no está disponible.

#### [MODIFY] [package.json](file:///c:/laragon/www/chat-websockets/package.json)
- Añadir dependencias de `pg` y `dotenv` para la configuración.

#### [NEW] [.env](file:///c:/laragon/www/chat-websockets/.env)
- Archivo de variables de entorno para configurar las credenciales de PostgreSQL de Laragon.
```env
PORT=3001
DB_USER=postgres
DB_PASSWORD=
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=chat_websockets
```

---

### Frontend (Cliente)

Rediseñaremos completamente la interfaz usando Vanilla CSS de alta calidad (Modo Oscuro, Glassmorphism, transiciones fluidas, tipografía moderna) y Vue 3 para mantener la lógica reactiva y simple.

#### [MODIFY] [public/index.html](file:///c:/laragon/www/chat-websockets/public/index.html)
- Diseñar la estructura de tres paneles:
  - **Panel Izquierdo (Sidebar):** Perfil del usuario actual (con selector de avatar/color), lista de canales, y lista de chats directos.
  - **Panel Central (Área de Chat):** Cabecera del canal/DM, historial con scroll automático inteligente, indicador de escritura ("X está escribiendo..."), y barra de entrada de mensajes.
  - **Panel Derecho (Miembros):** Lista de usuarios en el servidor con estados, colapsable con un botón.
- Integrar un **Selector de Emojis** rápido y un **Selector de GIFs** con biblioteca integrada para una experiencia interactiva sin añadir scripts pesados.
- Importar tipografía moderna (por ejemplo, `Outfit` y `Inter` desde Google Fonts) y un set de iconos elegantes (por ejemplo, Lucide o Bootstrap Icons vía CDN).

#### [MODIFY] [public/app.js](file:///c:/laragon/www/chat-websockets/public/app.js)
- Gestionar el estado de canales activos y chats privados abiertos.
- Enviar eventos de escritura con *debounce* (para no saturar el socket).
- Integrar lógica de mensajes directos temporales (al dar clic en un usuario, se abre un canal de conversación privada en base a su ID único).
- Manejar la inserción de Emojis y GIFs con enlaces directos para cargarlos en tiempo real en las burbujas de chat.

#### [MODIFY] [public/styles.css](file:///c:/laragon/www/chat-websockets/public/styles.css)
- Implementar un diseño premium en Modo Oscuro:
  - Colores de fondo profundos inspirados en Discord (`#1e1f22`, `#2b2d31`, `#313338`).
  - Acentos inspirados en WhatsApp (`#00a884`) y Discord (`#5865f2`).
  - Efectos visuales de Glassmorphism, bordes semi-transparentes y sombras difusas.
  - Avatares circulares personalizados con indicadores de estado pulsantes (activo, ausente, escribiendo).
  - Animaciones elegantes para la aparición de nuevos mensajes y transiciones de ventanas.

---

## Verification Plan

### Automated & Manual Tests
1. **Instalación y Configuración:**
   - Ejecutar `npm install` para añadir `pg` y `dotenv`.
   - Iniciar el servidor localmente con `npm start`.
2. **Pruebas de Funcionalidad Multiusuario:**
   - Abrir el chat en dos navegadores diferentes.
   - Probar el cambio de nombre, avatar y color de perfil.
   - Cambiar entre canales y verificar que los mensajes se aísen por canal.
   - Hacer clic en un usuario activo para iniciar un DM privado y corroborar que solo ellos dos reciban los mensajes.
   - Escribir un mensaje y comprobar que aparezca el indicador "... está escribiendo" en el otro navegador.
3. **Prueba de Emojis y GIFs:**
   - Enviar un mensaje con emojis del selector.
   - Seleccionar un GIF de la galería y enviarlo, verificando que se renderice como imagen animada directamente en el flujo del chat.
4. **Prueba de Base de Datos PostgreSQL:**
   - Iniciar una base de datos local y verificar la persistencia del historial al recargar la página.
   - Detener la base de datos y verificar que el chat siga funcionando de inmediato sin romperse, utilizando el fallback en memoria.
