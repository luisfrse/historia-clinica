'use strict';
/* Tema claro/oscuro: sigue al sistema salvo que se haya elegido uno a mano (se guarda solo en este navegador).
   Va en <head> y sin defer para que no parpadee. app.js usa window.HCTheme para el botón de la cabecera. */
(() => {
  const KEY = 'historia-theme';
  const read = () => { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch (_) { return 'auto'; } };
  const apply = (v) => { if (v === 'light' || v === 'dark') document.documentElement.setAttribute('data-theme', v); else document.documentElement.removeAttribute('data-theme'); };
  apply(read());
  window.HCTheme = {
    get: read,
    /* auto -> oscuro -> claro -> auto */
    next() { const c = read(), n = c === 'auto' ? 'dark' : c === 'dark' ? 'light' : 'auto'; try { if (n === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, n); } catch (_) { /* sin almacenamiento */ } apply(n); return n; },
  };
})();
