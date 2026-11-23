// Usuarios de MongoDB de Task-MK (plan-infrastructure, fase 4; SEC-024).
//
// La imagen oficial de mongo ejecuta este fichero con mongosh, como root, solo
// cuando inicializa un volumen vacío. Root lo crea la propia imagen a partir de
// MONGO_INITDB_ROOT_USERNAME y MONGO_INITDB_ROOT_PASSWORD.
//
// Crea:
//   - app:     rol propio con find, insert, update y remove sobre la base de la
//              aplicación. Se autentica en esa base. Sin createIndex ni drop.
//   - migrate: readWrite sobre la base de la aplicación. Se autentica en ella.
//   - backup:  rol backup. Se autentica en admin.
//
// No crea colecciones ni índices: eso es de las migraciones.
// Nunca imprime contraseñas.

const REQUIRED = [
  'MONGO_INITDB_DATABASE',
  'MONGO_APP_USER',
  'MONGO_APP_PASSWORD',
  'MONGO_MIGRATE_USER',
  'MONGO_MIGRATE_PASSWORD',
  'MONGO_BACKUP_USER',
  'MONGO_BACKUP_PASSWORD',
];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`init.js: faltan variables de entorno: ${missing.join(', ')}`);
}

const env = process.env;
const appDb = db.getSiblingDB(env.MONGO_INITDB_DATABASE);
const adminDb = db.getSiblingDB('admin');

const APP_ROLE = 'taskmkApp';

function ensureRole(targetDb, role, privileges) {
  if (targetDb.getRole(role) !== null) {
    print(`init.js: el rol ${targetDb.getName()}.${role} ya existe, no se modifica`);
    return;
  }
  targetDb.createRole({ role, privileges, roles: [] });
  print(`init.js: rol ${targetDb.getName()}.${role} creado`);
}

function ensureUser(targetDb, user, pwd, roles) {
  if (targetDb.getUser(user) !== null) {
    print(`init.js: el usuario ${targetDb.getName()}.${user} ya existe, no se modifica`);
    return;
  }
  targetDb.createUser({ user, pwd, roles });
  print(`init.js: usuario ${targetDb.getName()}.${user} creado`);
}

ensureRole(appDb, APP_ROLE, [
  {
    resource: { db: appDb.getName(), collection: '' },
    actions: ['find', 'insert', 'update', 'remove'],
  },
]);

ensureUser(appDb, env.MONGO_APP_USER, env.MONGO_APP_PASSWORD, [
  { role: APP_ROLE, db: appDb.getName() },
]);

ensureUser(appDb, env.MONGO_MIGRATE_USER, env.MONGO_MIGRATE_PASSWORD, [
  { role: 'readWrite', db: appDb.getName() },
]);

ensureUser(adminDb, env.MONGO_BACKUP_USER, env.MONGO_BACKUP_PASSWORD, [
  { role: 'backup', db: 'admin' },
]);
