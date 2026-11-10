/* Disuasión de copiar y pegar para el alumnado (no para profesorado ni administración).
   Se activa/desactiva con la clase «nocopy» de <html> (la pone app.js según el rol).
   No es una barrera técnica absoluta: no impide capturas de pantalla ni fotos. */
(() => {
  const root = document.documentElement;
  const on = () => root.classList.contains('nocopy');
  ['copy', 'cut', 'paste', 'dragstart', 'drop', 'contextmenu', 'selectstart'].forEach((ev) =>
    document.addEventListener(ev, (e) => { if (on()) e.preventDefault(); }, true));
  document.addEventListener('keydown', (e) => {
    if (!on() || !(e.ctrlKey || e.metaKey)) return;
    if (['c', 'x', 'v', 'a', 'u', 's', 'p'].includes(e.key.toLowerCase())) e.preventDefault();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (on() && e.shiftKey && e.key === 'Insert') e.preventDefault(); /* Mayús+Insert = pegar */
  }, true);
})();
