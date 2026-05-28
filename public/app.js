const { createApp, nextTick } = Vue;

createApp({
  data() {
    const defaultName = `Usuario ${Math.floor(Math.random() * 900 + 100)}`;

    return {
      socket: null,
      defaultName,
      name: defaultName,
      message: '',
      statusText: 'Conectando...',
      statusKind: 'secondary',
      messages: [],
      nextId: 2,
      messagesBox: null
    };
  },
  computed: {
    statusClass() {
      if (this.statusKind === 'success') {
        return 'success';
      }

      if (this.statusKind === 'danger') {
        return 'danger';
      }

      return '';
    }
  },
  methods: {
    messageClass(kind) {
      if (kind === 'system') {
        return 'alert-info';
      }

      if (kind === 'mine') {
        return 'alert-success';
      }

      return 'alert-light border';
    },
    pushMessage(kind, text, meta) {
      this.messages.push({
        id: this.nextId++,
        kind,
        text,
        meta
      });

      nextTick(() => {
        if (this.$refs.messagesBox) {
          this.$refs.messagesBox.scrollTop = this.$refs.messagesBox.scrollHeight;
        }
      });
    },
    connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.socket = new WebSocket(`${protocol}//${location.host}`);

      this.socket.addEventListener('open', () => {
        this.statusText = 'Conectado';
        this.statusKind = 'success';
        this.socket.send(JSON.stringify({ type: 'join', name: this.name }));
      });

      this.socket.addEventListener('close', () => {
        this.statusText = 'Desconectado';
        this.statusKind = 'danger';
        console.info('[Sistema]', 'El servidor cerró la conexión.');
      });

      this.socket.addEventListener('message', (event) => {
        let data;

        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.type === 'system') {
          console.info('[Sistema]', data.text);
          return;
        }

        if (data.type === 'message') {
          const isMine = data.from === this.name;
          this.pushMessage(
            isMine ? 'mine' : 'other',
            data.text,
            `${data.from} · ${data.time || ''}`.trim()
          );
        }
      });
    },
    updateName() {
      const cleanName = this.name.trim() || this.defaultName;
      this.name = cleanName;

      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'join', name: cleanName }));
      }
    },
    sendMessage() {
      const text = this.message.trim();

      if (!text || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      this.socket.send(JSON.stringify({ type: 'message', text }));
      this.message = '';
    }
    ,
    clearMessages() {
      // Limpia solo la vista local de mensajes; no afecta a otros clientes.
      this.messages = [];
      console.info('[Sistema]', 'Mensajes limpiados localmente.');
    }
  },
  mounted() {
    this.connect();
  },
  beforeUnmount() {
    if (this.socket) {
      this.socket.close();
    }
  }
}).mount('#app');