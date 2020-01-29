import i18n from 'i18n';
import path from 'path';

i18n.configure({
  locales: ['en', 'pt-br'],
  defaultLocale: 'pt-br',
  queryParameter: 'lang',
  directory: path.join('./', 'locales'),
  api: {
    '__': 'translate',  
    '__n': 'translateN' 
  },
});

export default i18n;