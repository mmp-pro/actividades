// ═══════════════════════════════════════════
//  CONFIGURACIÓN DE BASE DE DATOS
//  Cambia TU_CONTRASEÑA por tu contraseña real
// ═══════════════════════════════════════════

const config = {
  server: 'SERVER',
  database: 'DiarioActividades',
  user: 'sa',
  password: 'Ul1979_*',
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  port: 1433
};

module.exports = config;
