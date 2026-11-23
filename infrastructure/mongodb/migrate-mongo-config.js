// Configuración de migrate-mongo (plan-infrastructure, fase 4, tarea 3).
// Sin valores por defecto: si falta MONGODB_URI o no indica la base, falla.
'use strict';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('migrate-mongo-config.js: falta la variable MONGODB_URI');
}

// La base es la ruta del URI: mongodb://usuario:contraseña@host:puerto/<base>?opciones
const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^/?]+)/.exec(uri);
if (!match) {
  throw new Error('migrate-mongo-config.js: MONGODB_URI no indica la base de datos');
}

module.exports = {
  mongodb: {
    url: uri,
    databaseName: decodeURIComponent(match[1]),
    options: {},
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'migrations',
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'commonjs',
};
