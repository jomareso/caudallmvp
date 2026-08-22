import { getRequestConfig } from 'next-intl/server';

// MVP: solo español (Decisión 5 de docs/decisions.md), pero la infraestructura
// de i18n queda lista desde el día 1 para agregar locales sin reescribir la UI.
const locale = 'es';

export default getRequestConfig(async () => ({
  locale,
  messages: (await import(`../../../messages/${locale}.json`)).default
}));
