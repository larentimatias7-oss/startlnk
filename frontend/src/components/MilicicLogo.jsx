import React from 'react';

/**
 * Componente corporativo reutilizable para el Logo de Milicic S.A.
 * Incluye adaptación cromática automática (filtro blanco puro en fondos oscuros / dark mode).
 * 
 * @param {number} height - Altura en píxeles (default: 28px, rango estándar 28-32px)
 * @param {boolean} white - Forzar renderizado en blanco puro para cabeceras oscuras
 * @param {string} className - Clases adicionales de estilo
 */
export default function MilicicLogo({ height = 28, white = false, className = '' }) {
  const whiteClass = white ? 'white-logo' : '';

  return (
    <img
      src="/milicic-logo.png"
      alt="Milicic S.A."
      style={{ height: `${height}px` }}
      className={`milicic-img ${whiteClass} ${className}`}
      loading="eager"
    />
  );
}
