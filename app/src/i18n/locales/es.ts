/**
 * Spanish (es) stub locale.
 *
 * Partial coverage is acceptable for Wave 11; missing keys fall back to
 * `en` per the `I18nProvider` resolution rules. This is a seed — full
 * translation review is out of scope for the scaffold.
 */

import type { Messages } from '../messages';

export const es: Partial<Messages> = {
  'app.title': 'LeaseGuard',
  'app.tagline': 'Analizador de contratos local y privado. Nada sale de su dispositivo.',
  'header.privacy.summary': 'Privacidad y cómo funciona',
  'header.upload.label': 'Cargar contrato',
  'header.trySample': 'Probar un contrato de ejemplo',
  'header.view.current': 'Contrato actual',
  'header.view.portfolio': 'Cartera',
  'header.view.redline': 'Edición',

  'locale.picker.label': 'Idioma',
  'locale.picker.en': 'Inglés',
  'locale.picker.es': 'Español',

  'status.analyzing': 'Analizando {fileName}…',
  'status.error': 'No se pudo analizar este archivo: {message}',

  'findings.export.json': 'Exportar resultados (JSON)',
  'findings.export.html': 'Exportar resultados (HTML imprimible)',

  'footer.clearAll': 'Borrar todos los datos guardados',
};
