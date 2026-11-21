'use strict';
/* Iconos que Historia clínica necesita y el diseño común aún no trae (mismo trazo: 24 px, 1,75, extremos redondeados, currentColor).
   Se añaden al conjunto común al cargar; si algún día pasan al común, basta con borrar la entrada de aquí. */
(function (root) {
  if (!root.DCIcons) return;
  Object.assign(root.DCIcons.paths, {
    'thermometer': 'M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0zM12 9v7',
    'droplet': 'M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z',
    'pill': 'M10.5 20.5a4.6 4.6 0 0 1-6.5-6.5l9.5-9.5a4.6 4.6 0 0 1 6.5 6.5zM8.7 8.8l6.5 6.5',
    'clipboard': 'M9 4.5h6M9 4.5a1.5 1.5 0 0 0-1.5 1.5v.5h9V6A1.5 1.5 0 0 0 15 4.5M7.5 6.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7.5a1 1 0 0 0-1-1h-1.5M8.5 12h7M8.5 16h5',
    'gauge': 'M4.5 18a8.5 8.5 0 1 1 15 0M12 13.5l4-4M12 13.5h.01',
    'message': 'M4 5.5h16v11H9.5L5 20.5v-4H4z',
    'printer': 'M7 8.5V3.5h10v5M7 17.5H4.5v-9h15v9H17M7 14h10v6.5H7z',
    'arrow-up': 'M12 19V5M6 11l6-6 6 6',
    'arrow-down': 'M12 5v14M6 13l6 6 6-6',
    'archive': 'M3.5 5h17v4h-17zM5 9v10.5h14V9M10 13h4',
    'filter': 'M4 5.5h16l-6 7.5v6l-4-2v-4z',
    'user-check': 'M9.5 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2.5 20.5a7 7 0 0 1 14 0M16.5 11l2 2 3.5-4',
    'pencil-off': 'M4 20l1-4L16.5 4.5l3 3L8 19zM13.5 7.5l3 3M3.5 3.5l17 17',
    'minus-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12h8',
    'circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'stethoscope': 'M6 3.5v6a4 4 0 0 0 8 0v-6M6 3.5H4.5M14 3.5h1.5M10 13.5v1.5a4.5 4.5 0 0 0 9 0v-2.5M19 12.5a1.8 1.8 0 1 0 0-.01'
  });
  if (root.DCIcons.upgrade) root.DCIcons.upgrade();
})(window);
