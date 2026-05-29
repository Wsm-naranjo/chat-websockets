const { createApp, nextTick } = Vue;

createApp({
  data() {
    // Cada pestaña tiene su propio ID único (sessionStorage es exclusivo por pestaña)
    let mySessionId = sessionStorage.getItem('nebula_tab_id');
    if (!mySessionId) {
      mySessionId = 'tab_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36).slice(-4);
      sessionStorage.setItem('nebula_tab_id', mySessionId);
    }

    // Usar sessionStorage para mantener la identidad por pestaña, con fallback a localStorage o random
    let myName = sessionStorage.getItem('nebula_tab_username');
    if (!myName) {
      const randNum = Math.floor(Math.random() * 9000 + 1000);
      myName = localStorage.getItem('nebula_username') || `Invitado_${randNum}`;
      sessionStorage.setItem('nebula_tab_username', myName);
    }

    let myAvatar = sessionStorage.getItem('nebula_tab_avatar');
    if (!myAvatar) {
      myAvatar = localStorage.getItem('nebula_avatar') || `avatar${Math.floor(Math.random() * 6 + 1)}`;
      sessionStorage.setItem('nebula_tab_avatar', myAvatar);
    }

    let myColor = sessionStorage.getItem('nebula_tab_color');
    if (!myColor) {
      myColor = localStorage.getItem('nebula_color') || '#5865f2';
      sessionStorage.setItem('nebula_tab_color', myColor);
    }

    const hasJoined = sessionStorage.getItem('nebula_tab_joined') === 'true';

    return {
      // Estado de Conexión
      socket: null,
      mySessionId,
      myName,
      myAvatar,
      myColor,
      hasJoined,
      dbConnected: false,

      // Estado de Edición de Perfil
      showProfileEdit: false,
      tempName: myName,
      tempAvatar: myAvatar,
      tempColor: myColor,

      // Estado de Salas e Historial
      activeRoom: 'general', // 'general' por defecto
      activeDMRecipient: null, // Si es no nulo, indica que chateamos en privado
      messageText: '',
      messages: {
        general: [],
        gaming: [],
        memes: [],
        tecnologia: []
      },
      channels: [
        { id: 'general', name: 'general', description: 'Canal general del servidor. ¡Bienvenido!' },
        { id: 'gaming', name: 'gaming', description: 'Para hablar de videojuegos, consolas y más.' },
        { id: 'memes', name: 'memes', description: 'Comparte imágenes graciosas, enlaces y risas.' },
        { id: 'tecnologia', name: 'tecnología', description: 'Canal de programadores, gadgets y hardware.' }
      ],
      activeUsers: [], // Usuarios remotos activos

      // Mensajes no leídos (Notificaciones)
      unreadChannels: {},
      unreadDMs: {},

      // Interacción
      showRightPanel: true,
      typingUsers: {}, // sessionID -> { displayName, timeout }
      isTyping: false,
      typingTimeout: null,

      // Selectores Popover
      showEmojiPicker: false,
      showGIFPicker: false,
      activeEmojiCategory: 'smileys',
      gifSearchQuery: '',
      loadingGIFs: false,

      // Catálogo de Avatares Elegibles
      availableAvatars: {
        avatar1: '🐱',
        avatar2: '🐶',
        avatar3: '🦊',
        avatar4: '🤖',
        avatar5: '👽',
        avatar6: '🐼',
        avatar7: '🦁',
        avatar8: '🦄'
      },

      // Colores Neon de Acento
      presetColors: [
        '#5865f2', // Discord Indigo
        '#00a884', // WhatsApp Green
        '#ec4899', // Pink Neon
        '#a855f7', // Purple Neon
        '#06b6d4', // Cyan Neon
        '#f59e0b', // Amber Neon
        '#10b981', // Emerald Green
        '#ef4444'  // Rose Red
      ],

      // Biblioteca de Emojis categorizados
      emojiCategories: [
        { id: 'smileys', icon: '😀' },
        { id: 'animals', icon: '🦁' },
        { id: 'food', icon: '🍕' },
        { id: 'activities', icon: '🎮' },
        { id: 'objects', icon: '💡' },
        { id: 'symbols', icon: '❤️' }
      ],
      emojisData: {
        smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🫢', '🤫', '🤥', '😶', '😐', '😑', '😬', '🫠', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '😵‍💫', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕'],
        animals: ['🐱', '🐶', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🐙', '🦑', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', ' bison', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🐐', '🦌', '🐕', '🐩', '🐈', '🐈‍⬛', '🐇', '🐿️', '🦫', '🦔', '🦇', '🐻‍❄️'],
        food: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🍿', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍣', '🍤', '🍥', '🦪', '🥟', '🍢', '🍡', '🍧', '🍨', '🍦', '🍰', '🎂', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯'],
        activities: ['👾', '🎮', '🕹️', '🎰', '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏹', '🎣', '🤿', '🥊', '🥋', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚴', '🚵', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎗️', '🎫', '🎟️', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '🧩', '🎳', '🎯'],
        objects: ['💡', '🔦', '🕯️', '🔑', '🗝️', '🔨', '🪓', '⛏️', '🔧', '🪛', '⚙️', '🧱', '⛓️', '🪝', '🔫', '💣', '🛡️', '🚬', '⚰️', '🪦', '🔮', '🧿', '📿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🌡️', '🧼', '🧽', '🚿', '🛁', '🚽', '🪞', '🪥', '🧺', '🧹', '🔑', '🔒', '🔓', '🔏', '🔐', '🔑', '🏷️', '📦', '📪', '📮', '📯', '📜', '📄', '📅', '🗑️', '✏️', '✒️', '📎', '📏', '📐', '📂', '📁', '💻', '🖥️', '⌨️', '🖱️', '🖨️', '📱', '☎️', '📻', '📺', '📷', '📹', '📼', '💿', '📀'],
        symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '⛎', '🔀', '🔁', '🔂', '▶️', '⏩', '◀️', '⏪', '🔼', '🚀', '⭐', '✨', '⚡', '🔥', '💥', '🌈', '☀️', '☁️', '❄️', '💤', '💯', '🔔', '🔕', '💬', '💬', '👁️‍🗨️', '⚠️', '🚫', '🛑', '⛔', '➕', '➖', '✖️', 'Ⓨ', 'Ⓝ', '🆗', '🆒', '🆕']
      },

      // Biblioteca Curada de GIFs de alta calidad (offline-safe y estables)
      gifCategories: ['Celebrar', 'Sorprendido', 'Programación', 'Gatos', 'Sí', 'No', 'Facepalm', 'Aplausos', 'Enojado'],
      gifsDatabase: [
        { id: 1, category: 'Celebrar', name: 'dance-party', url: 'https://media.giphy.com/media/26n6R5HO1II3J9MqY/giphy.gif', preview: 'https://media.giphy.com/media/26n6R5HO1II3J9MqY/giphy.gif?w=150' },
        { id: 2, category: 'Celebrar', name: 'celebration', url: 'https://media.giphy.com/media/l41YcGT5zAfM15NLi/giphy.gif', preview: 'https://media.giphy.com/media/l41YcGT5zAfM15NLi/giphy.gif?w=150' },
        { id: 3, category: 'Sorprendido', name: 'mindblown', url: 'https://media.giphy.com/media/xT0xeJpD8e4DYnCHq8/giphy.gif', preview: 'https://media.giphy.com/media/xT0xeJpD8e4DYnCHq8/giphy.gif?w=150' },
        { id: 4, category: 'Sorprendido', name: 'shook', url: 'https://media.giphy.com/media/26H73Dl4HXXFe/giphy.gif', preview: 'https://media.giphy.com/media/26H73Dl4HXXFe/giphy.gif?w=150' },
        { id: 5, category: 'Programación', name: 'coding-hard', url: 'https://media.giphy.com/media/9Ai5dIk8xvYEQ/giphy.gif', preview: 'https://media.giphy.com/media/9Ai5dIk8xvYEQ/giphy.gif?w=150' },
        { id: 6, category: 'Programación', name: 'it-works', url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif', preview: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif?w=150' },
        { id: 7, category: 'Gatos', name: 'kitty-popcorn', url: 'https://media.giphy.com/media/CjmvTCZf2U3p09Cn0h/giphy.gif', preview: 'https://media.giphy.com/media/CjmvTCZf2U3p09Cn0h/giphy.gif?w=150' },
        { id: 8, category: 'Gatos', name: 'typing-cat', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMHlhN3Y2dHB6YTB5ZHN5d3Z2NTVlZml2bzMxMzIybXp0YWlhazdrNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oriO0OEd9hmFFI1pe/giphy.gif', preview: 'https://media.giphy.com/media/3oriO0OEd9hmFFI1pe/giphy.gif?w=150' },
        { id: 9, category: 'Sí', name: 'nod-yes', url: 'https://media.giphy.com/media/3oz8xAFtqo0LGR2TgK/giphy.gif', preview: 'https://media.giphy.com/media/3oz8xAFtqo0LGR2TgK/giphy.gif?w=150' },
        { id: 10, category: 'Sí', name: 'minions-yes', url: 'https://media.giphy.com/media/13ZHydAYC9mhi0/giphy.gif', preview: 'https://media.giphy.com/media/13ZHydAYC9mhi0/giphy.gif?w=150' },
        { id: 11, category: 'No', name: 'shaking-head', url: 'https://media.giphy.com/media/12XTNObsY19W5G/giphy.gif', preview: 'https://media.giphy.com/media/12XTNObsY19W5G/giphy.gif?w=150' },
        { id: 12, category: 'No', name: 'nope', url: 'https://media.giphy.com/media/gfT2hGhrAgWkGzUPeY/giphy.gif', preview: 'https://media.giphy.com/media/gfT2hGhrAgWkGzUPeY/giphy.gif?w=150' },
        { id: 13, category: 'Facepalm', name: 'picard-facepalm', url: 'https://media.giphy.com/media/3xz2BLBOKhjKuDQd68/giphy.gif', preview: 'https://media.giphy.com/media/3xz2BLBOKhjKuDQd68/giphy.gif?w=150' },
        { id: 14, category: 'Facepalm', name: 'dog-facepalm', url: 'https://media.giphy.com/media/12yR7vvamCMahO/giphy.gif', preview: 'https://media.giphy.com/media/12yR7vvamCMahO/giphy.gif?w=150' },
        { id: 15, category: 'Aplausos', name: 'clapping-applause', url: 'https://media.giphy.com/media/ytTYwIlbD1Fss/giphy.gif', preview: 'https://media.giphy.com/media/ytTYwIlbD1Fss/giphy.gif?w=150' },
        { id: 16, category: 'Aplausos', name: 'clap-leonardo', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnYweHpkb2tsMmJmNm4zd3l1NnBxZ3pjYmZ1cTJxdWpsMm9tM2IxeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/8Iv5lWKWUnT44/giphy.gif', preview: 'https://media.giphy.com/media/8Iv5lWKWUnT44/giphy.gif?w=150' },
        { id: 17, category: 'Enojado', name: 'fuming', url: 'https://media.giphy.com/media/11tI0e7CO6x0pG/giphy.gif', preview: 'https://media.giphy.com/media/11tI0e7CO6x0pG/giphy.gif?w=150' },
        { id: 18, category: 'Enojado', name: 'no-more', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDBsc3RnaTZid2c0azhqenB4MDZwdmNxbDJtbDJnbTFpdDJqYW52NiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/k3P1HSUYNwzb2/giphy.gif', preview: 'https://media.giphy.com/media/k3P1HSUYNwzb2/giphy.gif?w=150' }
      ]
    };
  },

  computed: {
    // Retorna los usuarios en línea filtrando a nosotros mismos
    onlineUsersList() {
      return this.activeUsers.filter(u => u.sessionId !== this.mySessionId);
    },

    // Total de usuarios activos sin contarnos
    activeUsersCount() {
      return this.onlineUsersList.length;
    },

    // Retorna el historial de mensajes de la sala o conversación activa
    activeMessages() {
      const key = this.messagesKey();
      return this.messages[key] || [];
    },

    // Determina si algún usuario remoto está escribiendo en el chat activo
    someoneIsTyping() {
      const typingIds = Object.keys(this.typingUsers);
      if (typingIds.length === 0) return false;

      // Si es un chat directo (DM)
      if (this.activeDMRecipient) {
        return !!this.typingUsers[this.activeDMRecipient.sessionId];
      }

      // Si es un canal, verificar si escriben en ese canal
      return typingIds.some(id => this.typingUsers[id].channelId === this.activeRoom);
    },

    // Texto descriptivo del indicador de escritura
    typingIndicatorText() {
      const typingInThisRoom = [];
      for (const id in this.typingUsers) {
        const tUser = this.typingUsers[id];
        if (this.activeDMRecipient) {
          if (id === this.activeDMRecipient.sessionId) {
            typingInThisRoom.push(tUser.displayName);
          }
        } else {
          if (tUser.channelId === this.activeRoom) {
            typingInThisRoom.push(tUser.displayName);
          }
        }
      }

      if (typingInThisRoom.length === 1) {
        return `${typingInThisRoom[0]} está escribiendo...`;
      } else if (typingInThisRoom.length > 1) {
        return `${typingInThisRoom.join(', ')} están escribiendo...`;
      }
      return '';
    },

    // Placeholder adaptativo para el input
    inputPlaceholder() {
      if (this.activeDMRecipient) {
        return `Enviar mensaje privado a @${this.activeDMRecipient.displayName}...`;
      }
      return `Enviar mensaje a #${this.activeRoom}...`;
    },

    // Estilo personalizado para el banner de bienvenida del canal
    welcomeBannerStyle() {
      if (this.activeDMRecipient) {
        return { background: `linear-gradient(135deg, ${this.activeDMRecipient.color} 0%, #1e1f22 100%)` };
      }
      return { background: 'linear-gradient(135deg, var(--discord-indigo) 0%, #1e1f22 100%)' };
    },

    // Título dinámico para el banner de bienvenida
    welcomeBannerTitle() {
      if (this.activeDMRecipient) {
        return `¡Aquí comienza tu conversación con ${this.activeDMRecipient.displayName}!`;
      }
      return `¡Te damos la bienvenida a #${this.activeRoom}!`;
    },

    // Descripción dinámica para el banner de bienvenida
    welcomeBannerDescription() {
      if (this.activeDMRecipient) {
        return `Este es el comienzo de tus mensajes directos y privados 1:1 con @${this.activeDMRecipient.displayName}.`;
      }
      const channel = this.channels.find(c => c.id === this.activeRoom);
      return channel ? channel.description : 'Este es el inicio del canal.';
    },

    // Retorna los GIFs filtrados por búsqueda o por categoría
    filteredGIFs() {
      if (this.gifSearchQuery) {
        const query = this.gifSearchQuery.toLowerCase().trim();
        return this.gifsDatabase.filter(gif =>
          gif.name.toLowerCase().includes(query) ||
          gif.category.toLowerCase().includes(query)
        );
      }
      return this.gifsDatabase; // Todos si no hay filtro
    },

    // Nombre y descripción del canal público activo
    activeChannelName() {
      const channel = this.channels.find(c => c.id === this.activeRoom);
      return channel ? channel.name : '';
    },

    activeChannelDescription() {
      const channel = this.channels.find(c => c.id === this.activeRoom);
      return channel ? channel.description : '';
    },

    // Indicador visual de estado de base de datos
    dbStatusClass() {
      return this.dbConnected ? 'success' : 'danger';
    },

    dbStatusTitle() {
      return this.dbConnected
        ? 'Base de datos PostgreSQL Conectada (Persistencia Activa)'
        : 'Usando Modo Fallback en Memoria RAM';
    }
  },

  methods: {
    // Helper para retornar emojis por llave de avatar
    avatarEmoji(key) {
      return this.availableAvatars[key] || '🐱';
    },

    // Maneja la reconexión y WebSocket setup
    connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.socket = new WebSocket(`${protocol}//${location.host}`);

      this.socket.addEventListener('open', () => {
        // Enviar evento de Registro inmediato con nuestros datos locales
        this.sendWS({
          type: 'join',
          sessionId: this.mySessionId,
          name: this.myName,
          avatar: this.myAvatar,
          color: this.myColor
        });

        // Solicitar el historial del canal activo
        this.requestHistory(this.activeRoom);
      });

      this.socket.addEventListener('close', () => {
        console.warn('[NebulaWS] Desconectado. Reintentando conexión en 3 segundos...');
        setTimeout(() => this.connect(), 3000);
      });

      this.socket.addEventListener('message', (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        // Manejar los diferentes tipos de respuesta del servidor
        switch (data.type) {
          case 'joined':
            this.dbConnected = data.isDbConnected;
            break;

          case 'user_list':
            this.activeUsers = data.users;
            // Si el destinatario de nuestro DM activo se desconectó
            if (this.activeDMRecipient) {
              const stillOnline = this.activeUsers.some(u => u.sessionId === this.activeDMRecipient.sessionId);
              if (!stillOnline) {
                // Notificar en la cabecera
                console.info('[DM]', 'El destinatario de tu DM está desconectado.');
              }
            }
            break;

          case 'history':
            this.loadHistoryData(data);
            break;

          case 'message':
            this.handleIncomingMessage(data);
            break;

          case 'typing':
            this.handleRemoteTyping(data);
            break;

          case 'system':
            this.handleSystemMessage(data);
            break;
        }
      });
    },

    // Envía mensajes serializados por WebSocket de forma segura
    sendWS(payload) {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(payload));
      }
    },

    // Retorna la llave única para agrupar mensajes en la vista
    messagesKey() {
      if (this.activeDMRecipient) {
        // En DMs privados, la llave del historial será el ID único de la sesión del destinatario
        return `dm_${this.activeDMRecipient.sessionId}`;
      }
      return this.activeRoom;
    },

    // Solicita el historial para un canal o DM al servidor
    requestHistory(roomId, isDM = false) {
      const req = { type: 'get_history' };
      if (isDM) {
        req.recipientId = roomId;
      } else {
        req.channelId = roomId;
      }
      this.sendWS(req);
    },

    // Carga los mensajes recibidos del historial en memoria local
    loadHistoryData(data) {
      let key;
      if (data.channelId) {
        key = data.channelId;
      } else if (data.recipientId) {
        // Identificar la llave de DM correcta (con quién estamos chateando)
        const peerId = data.recipientId === this.mySessionId ? data.messages[0]?.sender_id : data.recipientId;
        key = `dm_${peerId || data.recipientId}`;
      }

      if (key) {
        this.messages[key] = data.messages || [];
        this.scrollToBottom();
      }
    },

    // Maneja un mensaje de chat ordinario en tiempo real
    handleIncomingMessage(data) {
      let key;
      if (data.channelId) {
        key = data.channelId;

        // Notificación de no leído si no estamos en ese canal
        if (key !== this.activeRoom || this.activeDMRecipient) {
          this.unreadChannels[key] = true;
        }
      } else if (data.recipientId) {
        // Mensaje Privado (DM)
        const peerId = data.senderId === this.mySessionId ? data.recipientId : data.senderId;
        key = `dm_${peerId}`;

        // Notificación de no leído si no estamos chateando con él
        if (!this.activeDMRecipient || this.activeDMRecipient.sessionId !== peerId) {
          this.unreadDMs[peerId] = (this.unreadDMs[peerId] || 0) + 1;
        }
      }

      if (!this.messages[key]) {
        this.messages[key] = [];
      }
      this.messages[key].push(data.message);
      this.scrollToBottom();
    },

    // Procesa avisos de escritura en tiempo real de otros usuarios
    handleRemoteTyping(data) {
      const senderId = data.senderId || data.recipientId; // Identificador remoto
      if (data.isTyping) {
        // Guardamos el estado y reseteamos temporizador de inactividad
        if (this.typingUsers[senderId]) {
          clearTimeout(this.typingUsers[senderId].timeout);
        }

        const timeout = setTimeout(() => {
          this.$deleteTypingUser(senderId);
        }, 3000); // Se borra automáticamente tras 3 segundos de inactividad

        this.typingUsers[senderId] = {
          displayName: data.senderName,
          channelId: data.channelId || null,
          timeout
        };
      } else {
        this.$deleteTypingUser(senderId);
      }
    },

    $deleteTypingUser(id) {
      if (this.typingUsers[id]) {
        clearTimeout(this.typingUsers[id].timeout);
        delete this.typingUsers[id];
      }
    },

    // Agrega mensajes del sistema (entradas, salidas, nicks)
    handleSystemMessage(data) {
      const key = data.channelId || 'general';
      if (!this.messages[key]) {
        this.messages[key] = [];
      }
      this.messages[key].push({
        id: 'sys_' + Math.random().toString(36).substring(2, 9),
        type: 'system',
        text: data.text,
        created_at: new Date()
      });
      this.scrollToBottom();
    },

    // Abre el menú popover de edición de perfil
    toggleProfileEdit() {
      this.showProfileEdit = !this.showProfileEdit;
      if (this.showProfileEdit) {
        // Precargar valores actuales
        this.tempName = this.myName;
        this.tempAvatar = this.myAvatar;
        this.tempColor = this.myColor;
        this.showEmojiPicker = false;
        this.showGIFPicker = false;
      }
    },

    // Guarda los cambios del perfil y los transmite al socket y localStorage/sessionStorage
    saveProfile() {
      const cleanName = this.tempName.trim();
      if (!cleanName) return;

      this.myName = cleanName;
      this.myAvatar = this.tempAvatar;
      this.myColor = this.tempColor;

      // Guardar en sessionStorage para la persistencia de esta pestaña
      sessionStorage.setItem('nebula_tab_username', cleanName);
      sessionStorage.setItem('nebula_tab_avatar', this.myAvatar);
      sessionStorage.setItem('nebula_tab_color', this.myColor);

      // También guardar en localStorage
      localStorage.setItem('nebula_username', cleanName);
      localStorage.setItem('nebula_avatar', this.myAvatar);
      localStorage.setItem('nebula_color', this.myColor);

      // Informar al servidor de nuestra actualización de perfil
      this.sendWS({
        type: 'join',
        sessionId: this.mySessionId,
        name: cleanName,
        avatar: this.myAvatar,
        color: this.myColor
      });

      this.showProfileEdit = false;
    },

    // Maneja el ingreso inicial desde el Lobby
    joinChat() {
      const cleanName = this.tempName.trim();
      if (!cleanName) return;

      this.myName = cleanName;
      this.myAvatar = this.tempAvatar;
      this.myColor = this.tempColor;

      // Guardar en sessionStorage para esta pestaña
      sessionStorage.setItem('nebula_tab_username', cleanName);
      sessionStorage.setItem('nebula_tab_avatar', this.myAvatar);
      sessionStorage.setItem('nebula_tab_color', this.myColor);
      sessionStorage.setItem('nebula_tab_joined', 'true');

      // Guardar en localStorage como preferencia general
      localStorage.setItem('nebula_username', cleanName);
      localStorage.setItem('nebula_avatar', this.myAvatar);
      localStorage.setItem('nebula_color', this.myColor);

      this.hasJoined = true;

      // Conectarse a WebSocket ahora que el usuario ingresó formalmente
      this.connect();
    },

    // Selección de Canales públicos (Estilo Discord)
    selectChannel(channelId) {
      this.activeRoom = channelId;
      this.activeDMRecipient = null;
      this.unreadChannels[channelId] = false;

      this.showEmojiPicker = false;
      this.showGIFPicker = false;

      // Solicitar historial de este canal si no lo tenemos precargado
      if (!this.messages[channelId] || this.messages[channelId].length === 0) {
        this.requestHistory(channelId);
      } else {
        this.scrollToBottom();
      }

      this.focusInput();
    },

    // Selección de DMs privados (Estilo WhatsApp)
    selectDM(user) {
      this.activeDMRecipient = user;
      const key = `dm_${user.sessionId}`;
      this.unreadDMs[user.sessionId] = 0;

      this.showEmojiPicker = false;
      this.showGIFPicker = false;

      // Si no tenemos el historial de DM en memoria local
      if (!this.messages[key] || this.messages[key].length === 0) {
        this.requestHistory(user.sessionId, true);
      } else {
        this.scrollToBottom();
      }

      this.focusInput();
    },

    // Envía el mensaje de texto ingresado
    sendMessage() {
      const text = this.messageText.trim();
      if (!text) return;

      const payload = {
        type: 'message',
        text
      };

      if (this.activeDMRecipient) {
        payload.recipientId = this.activeDMRecipient.sessionId;
      } else {
        payload.channelId = this.activeRoom;
      }

      this.sendWS(payload);
      this.messageText = '';

      // Detener estado de escritura local
      this.broadcastTyping(false);
      this.focusInput();
    },

    // Envía un GIF instantáneo
    sendGIF(gifUrl) {
      const payload = {
        type: 'message',
        text: `GIF: ${gifUrl}`
      };

      if (this.activeDMRecipient) {
        payload.recipientId = this.activeDMRecipient.sessionId;
      } else {
        payload.channelId = this.activeRoom;
      }

      this.sendWS(payload);
      this.showGIFPicker = false;
      this.focusInput();
    },

    // Control de escritura local con debounce inteligente
    handleInput() {
      if (!this.isTyping) {
        this.isTyping = true;
        this.broadcastTyping(true);
      }

      // Limpia timeout anterior
      if (this.typingTimeout) clearTimeout(this.typingTimeout);

      // Si el usuario deja de escribir por 1.5 segundos, avisamos de inactividad
      this.typingTimeout = setTimeout(() => {
        this.isTyping = false;
        this.broadcastTyping(false);
      }, 1500);
    },

    broadcastTyping(isTypingState) {
      const payload = {
        type: 'typing',
        isTyping: isTypingState
      };

      if (this.activeDMRecipient) {
        payload.recipientId = this.activeDMRecipient.sessionId;
      } else {
        payload.channelId = this.activeRoom;
      }

      this.sendWS(payload);
    },

    // Funciones del Selector de Emojis
    toggleEmojiPicker() {
      this.showEmojiPicker = !this.showEmojiPicker;
      this.showGIFPicker = false;
      this.showProfileEdit = false;
    },

    getEmojisByCategory(category) {
      return this.emojisData[category] || [];
    },

    insertEmoji(emoji) {
      this.messageText += emoji;
      this.showEmojiPicker = false;
      this.focusInput();
    },

    // Funciones del Selector de GIFs
    toggleGIFPicker() {
      this.showGIFPicker = !this.showGIFPicker;
      this.showEmojiPicker = false;
      this.showProfileEdit = false;
      this.gifSearchQuery = '';
    },

    selectGIFCategory(cat) {
      this.gifSearchQuery = cat;
    },

    debounceGIFSearch() {
      // Simula carga para un efecto visual de alta gama
      this.loadingGIFs = true;
      setTimeout(() => {
        this.loadingGIFs = false;
      }, 350);
    },

    // Limpia los mensajes en la vista local actual
    clearMessages() {
      const key = this.messagesKey();
      this.messages[key] = [];
      console.info('[SpaceChat]', 'Pantalla limpia localmente.');
    },

    // Alternar el panel lateral derecho de Miembros
    toggleRightPanel() {
      this.showRightPanel = !this.showRightPanel;
    },

    // Helpers Utilitarios
    formatTime(timeString) {
      if (!timeString) return '';
      const date = new Date(timeString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    formatSystemMessage(text) {
      // Reemplaza textos con negritas de markdown simple (`**texto**` -> `<strong>texto</strong>`)
      return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    },

    // Detectores de archivos y medios interactivos
    isMediaURL(text) {
      // Si el mensaje es una URL de imagen o un GIF
      const clean = text.trim();
      if (clean.startsWith('GIF: ')) return true;

      const regex = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp|svg))/i;
      return regex.test(clean);
    },

    getMediaURL(text) {
      const clean = text.trim();
      if (clean.startsWith('GIF: ')) {
        return clean.substring(5);
      }
      const match = clean.match(/(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp|svg))/i);
      return match ? match[0] : '';
    },

    isGIF(text) {
      return text.trim().startsWith('GIF: ');
    },

    userStatusClass(sessionId) {
      // Para este prototipo simple, todos los sockets en activeUsers están en línea
      // Si alguien está escribiendo, podemos representarlo con otro color (Morado)
      const typingIds = Object.keys(this.typingUsers);
      if (typingIds.includes(sessionId)) {
        return 'typing';
      }
      return 'online';
    },

    getDMStatusDescription(sessionId) {
      const typingIds = Object.keys(this.typingUsers);
      if (typingIds.includes(sessionId)) {
        return 'Escribiendo...';
      }
      return 'En línea';
    },

    getDMSubtext(sessionId) {
      const typingIds = Object.keys(this.typingUsers);
      if (typingIds.includes(sessionId)) {
        return 'Escribiendo...';
      }
      return 'En línea';
    },

    // Funciones de control de scroll de la caja de chat
    scrollToBottom() {
      nextTick(() => {
        const box = this.$refs.messagesBox;
        if (box) {
          box.scrollTop = box.scrollHeight;
        }
      });
    },

    focusInput() {
      nextTick(() => {
        if (this.$refs.chatInput) {
          this.$refs.chatInput.focus();
        }
      });
    }
  },

  mounted() {
    if (this.hasJoined) {
      this.connect();
    }

    // Al hacer clic fuera de popovers, cerrarlos (solo si el clic fue fuera de ellos)
    document.addEventListener('click', (e) => {
      const profileSection = document.querySelector('.user-profile-section');
      const emojiPopover = document.querySelector('.emoji-picker-popover');
      const gifPopover = document.querySelector('.gif-picker-popover');

      if (!profileSection || !profileSection.contains(e.target)) {
        this.showProfileEdit = false;
      }
      if (!emojiPopover || !emojiPopover.contains(e.target)) {
        this.showEmojiPicker = false;
      }
      if (!gifPopover || !gifPopover.contains(e.target)) {
        this.showGIFPicker = false;
      }
    });

    // Crear íconos de Lucide tras montar la vista
    nextTick(() => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    });
  },

  updated() {
    // Asegurar que Lucide refresque los iconos si Vue actualiza el DOM
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}).mount('#app');