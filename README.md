# Ejemplo simple de WebSocket

Este proyecto es un demo muy sencillo para entender cómo funciona WebSocket sin complicarse demasiado. Tiene:

- un servidor en Node.js
- una sola página hecha con Vue 3 + Bootstrap
- mensajes en tiempo real entre varias pestañas o dispositivos
- una interfaz visual simple y clara

## Qué se usa

- `Node.js`: para correr el servidor
- `express`: para servir la página web
- `ws`: para crear la conexión WebSocket
- `HTML`, `CSS` y `JavaScript`: para la vista y el cliente
- `Vue 3`: para montar la vista de una sola página
- `Bootstrap`: para dar estilo básico sin complicarlo

## Cómo funciona

1. Abres la página en el navegador.
2. El navegador crea una conexión WebSocket con el servidor.
3. Cuando escribes un mensaje, el cliente lo envía al servidor.
4. El servidor recibe ese mensaje y lo manda a todos los clientes conectados.
5. Todas las ventanas abiertas ven el mensaje al instante.

La diferencia con HTTP normal es que aquí la conexión queda abierta, así que el servidor y el navegador pueden hablar en cualquier momento sin tener que recargar la página.

## Archivos principales

- `server.js`: servidor WebSocket y lógica de difusión de mensajes
- `public/index.html`: una sola vista con Bootstrap y Vue
- `public/app.js`: conexión del navegador con el WebSocket
- `public/styles.css`: pequeños ajustes visuales

## Requisitos

- Tener Node.js instalado

## Instalación

Dentro de la carpeta del proyecto ejecuta:

```bash
npm install
```

## Cómo ejecutar

```bash
npm start
```

Luego abre:

```text
http://localhost:3001
```

## Cómo probarlo en 2 lados diferentes

### Opción 1: dos pestañas del mismo navegador

1. Abre `http://localhost:3001`.
2. Abre otra pestaña con la misma dirección.
3. Escribe un nombre distinto en cada pestaña.
4. Envía mensajes desde una pestaña y verás que aparecen en la otra.

### Opción 2: dos navegadores o dos dispositivos

1. En un equipo corre el servidor.
2. Averigua la IP local de ese equipo.
3. Desde otro navegador o celular abre `http://TU_IP_LOCAL:3001`.
4. Envía mensajes desde ambos lados.

Si pruebas desde otra máquina, asegúrate de que el puerto `3001` esté permitido por el firewall de Windows.

### Limpiar mensajes (local)

En la interfaz hay un botón "Limpiar" que borra solo los mensajes de la vista del cliente donde se pulsa. Esto no elimina mensajes en el servidor ni en otras conexiones; sirve para limpiar la pantalla mientras sigues conectado.

## Ideas para seguir aprendiendo

- agregar una lista de usuarios conectados
- guardar historial de mensajes
- añadir salas o canales
- usar autenticación

## Notas

Si no quieres usar `npm install` en cada prueba, puedes instalar las dependencias una sola vez y luego ejecutar `npm start` cuantas veces quieras.
