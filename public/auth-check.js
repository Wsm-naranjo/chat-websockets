// Verificar autenticación antes de cargar el chat (OPCIONAL)
// Si no hay sesión, permite acceso como usuario temporal
(async function() {
  const sessionToken = localStorage.getItem('sessionToken');
  const userId = localStorage.getItem('userId');

  // Si hay sesión, validarla
  if (sessionToken && userId) {
    try {
      const response = await fetch('/api/validate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken })
      });

      const data = await response.json();

      if (data.success) {
        // Sesión válida, actualizar datos del usuario
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('avatar', data.user.avatar);
        localStorage.setItem('color', data.user.color);
        console.log('[Auth] Sesión válida, usuario autenticado:', data.user.username);
      } else {
        // Sesión inválida, limpiar y permitir acceso temporal
        console.log('[Auth] Sesión inválida, acceso como usuario temporal');
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('userId');
      }
    } catch (error) {
      // Error de red, permitir acceso temporal
      console.log('[Auth] Error validando sesión, acceso como usuario temporal');
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('userId');
    }
  } else {
    // No hay sesión, acceso como usuario temporal
    console.log('[Auth] Sin sesión, acceso como usuario temporal');
  }
  
  // Continuar cargando el chat (temporal o autenticado)
})();
