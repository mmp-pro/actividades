// ═══════════════════════════════════════════
//  SERVIDOR BACKEND - Diario de Actividades
//  Ejecutar con: node server.js
// ═══════════════════════════════════════════

const express    = require('express');
const sql        = require('mssql');
const cors       = require('cors');
const path       = require('path');
const nodemailer = require('nodemailer');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const config     = require('./db.config');

const JWT_SECRET = 'DiarioActividades_Secret_2026!';

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Redirigir raíz a login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// ─── CONFIGURACIÓN DE CORREO ─────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'soporte.imedmex@gmail.com',
    pass: 'egeh ldmv rate uapb'
  }
});

const CORREO_DESTINO = 'soporte.att.abo84@gmail.com';

async function enviarCorreo({ asunto, titulo, categoria, prioridad, hora, descripcion, solucion, ticket, estado, tipo }) {
  const colores = { Alta: '#e74c3c', Media: '#c8952a', Baja: '#5a7a5c' };
  const iconos  = { nueva: '🆕', modificada: '✏️', completada: '✅', eliminada: '🗑️' };
  const color   = colores[prioridad] || '#333';
  const icono   = iconos[tipo]       || '📋';
  const fechaHora = new Date().toLocaleString('es-MX', {
    weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit'
  });

  const html = `
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#f5f0e8;border:1px solid #d4c9b0;">
    <div style="background:#1a1208;color:#f5f0e8;padding:24px 32px;">
      <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px;opacity:0.7;">Diario de Actividades</p>
      <p style="margin:0 0 4px;font-size:13px;opacity:0.7;letter-spacing:1px;">${ticket || ''}</p>
      <h1 style="margin:0;font-size:20px;font-weight:400;">${icono} ${asunto}</h1>
    </div>
    <div style="padding:32px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${ticket ? `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;color:#8a7f6e;width:140px;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Ticket</td>
          <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;font-weight:bold;font-size:15px;color:#0f1f3d;">${ticket}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;color:#8a7f6e;width:140px;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Actividad</td>
          <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;font-weight:bold;">${titulo}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;color:#8a7f6e;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Categoría</td>
          <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;">${categoria}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;color:#8a7f6e;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Prioridad</td>
          <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;">
            <span style="background:${color};color:white;padding:2px 10px;font-size:11px;letter-spacing:1px;">${prioridad}</span>
          </td>
        </tr>
        ${hora ? `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;color:#8a7f6e;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Hora</td>
          <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;">⏰ ${hora}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;color:#8a7f6e;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Estado</td>
          <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;">${estado}</td>
        </tr>
        ${descripcion ? `<tr>
          <td style="padding:10px 0;color:#8a7f6e;font-size:11px;letter-spacing:1px;text-transform:uppercase;vertical-align:top;">Descripción</td>
          <td style="padding:10px 0;color:#555;line-height:1.6;">${descripcion}</td>
        </tr>` : ''}
        ${solucion ? `<tr>
          <td style="padding:10px 0;color:#8a7f6e;font-size:11px;letter-spacing:1px;text-transform:uppercase;vertical-align:top;border-top:2px solid #5a7a5c;">✅ Solución</td>
          <td style="padding:10px 0;color:#1a5c2a;line-height:1.6;font-weight:500;border-top:2px solid #5a7a5c;">${solucion}</td>
        </tr>` : ''}
      </table>
    </div>
    <div style="background:#ede7d3;padding:16px 32px;font-size:11px;color:#8a7f6e;letter-spacing:1px;">
      📅 ${fechaHora} &nbsp;·&nbsp; Servidor: SERVER
    </div>
  </div>`;

  await transporter.sendMail({
    from: '"Diario de Actividades" <soporte.imedmex@gmail.com>',
    to:   CORREO_DESTINO,
    subject: ticket ? `${icono} [${ticket}] ${asunto}` : `${icono} ${asunto}`,
    html
  });
}

// ─── CONEXIÓN A SQL SERVER ───────────────────
let pool;
async function conectar() {
  try {
    pool = await sql.connect(config);
    console.log('✔ Conectado a SQL Server correctamente');
  } catch (err) {
    console.error('✘ Error al conectar a SQL Server:', err.message);
    process.exit(1);
  }
}

// ─── RUTAS API ───────────────────────────────

// GET /api/actividades
app.get('/api/actividades', authMiddleware, async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT
        ActividadID   AS id,
        Titulo        AS titulo,
        Descripcion   AS descripcion,
        Categoria     AS categoria,
        Prioridad     AS prioridad,
        CONVERT(VARCHAR(5), HoraProgramada, 108) AS hora,
        Estado        AS estado,
        Solucion      AS solucion,
        NumeroTicket  AS ticket,
        FechaRegistro AS fecha
      FROM Actividades
      ORDER BY
        CASE Prioridad WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 ELSE 3 END,
        HoraProgramada
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/actividades — crear nueva
app.post('/api/actividades', authMiddleware, async (req, res) => {
  const { titulo, descripcion, categoria, prioridad, hora } = req.body;
  if (!titulo) return res.status(400).json({ error: 'El título es obligatorio' });

  try {
    const result = await pool.request()
      .input('Titulo',         sql.NVarChar(200),  titulo)
      .input('Descripcion',    sql.NVarChar(1000), descripcion || null)
      .input('Categoria',      sql.NVarChar(50),   categoria   || 'Otro')
      .input('Prioridad',      sql.NVarChar(10),   prioridad   || 'Media')
      .input('HoraProgramada', sql.VarChar(5),      hora        || null)
      .query(`
        DECLARE @nextVal INT = NEXT VALUE FOR seq_Ticket;
        DECLARE @ticket VARCHAR(20) = 'TI#' + RIGHT(YEAR(GETDATE()),2) + RIGHT('00'+CAST(MONTH(GETDATE()) AS VARCHAR),2) + RIGHT('0000' + CAST(@nextVal AS VARCHAR),4);
        INSERT INTO Actividades (Titulo, Descripcion, Categoria, Prioridad, HoraProgramada, NumeroTicket)
        OUTPUT INSERTED.ActividadID, INSERTED.NumeroTicket
        VALUES (@Titulo, @Descripcion, @Categoria, @Prioridad, @HoraProgramada, @ticket)
      `);

    const id     = result.recordset[0].ActividadID;
    const ticket = result.recordset[0].NumeroTicket;

    try {
      await enviarCorreo({
        tipo: 'nueva',
        asunto: `Nueva actividad registrada: ${titulo}`,
        titulo, categoria, prioridad, hora, descripcion,
        ticket, estado: 'Pendiente'
      });
      console.log(`📧 Correo enviado — Nueva: ${titulo}`);
    } catch (mailErr) {
      console.warn('⚠ Correo no enviado:', mailErr.message);
    }

    res.json({ id, mensaje: 'Actividad creada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/actividades/:id/completar — cambiar estado
app.put('/api/actividades/:id/completar', authMiddleware, async (req, res) => {
  const { id }     = req.params;
  const { estado } = req.body;

  try {
    const info = await pool.request()
      .input('ID', sql.Int, id)
      .query('SELECT * FROM Actividades WHERE ActividadID = @ID');
    const act = info.recordset[0];

    const { solucion } = req.body;

    await pool.request()
      .input('Estado',   sql.NVarChar(20),   estado)
      .input('Solucion', sql.NVarChar(1000), solucion || null)
      .input('ID',       sql.Int,            id)
      .query(`
        UPDATE Actividades
        SET
          Estado          = @Estado,
          Solucion        = CASE WHEN @Estado = 'Completada' THEN @Solucion ELSE NULL END,
          FechaCompletado = CASE WHEN @Estado = 'Completada' THEN GETDATE() ELSE NULL END,
          ModificadoEn    = GETDATE()
        WHERE ActividadID = @ID
      `);

    try {
      const tipo = estado === 'Completada' ? 'completada' : 'modificada';
      const asunto = estado === 'Completada'
        ? `Actividad completada: ${act.Titulo}`
        : `Actividad reabierta: ${act.Titulo}`;
      await enviarCorreo({
        tipo, asunto,
        ticket:      act.NumeroTicket,
        titulo:      act.Titulo,
        categoria:   act.Categoria,
        prioridad:   act.Prioridad,
        hora:        act.HoraProgramada,
        descripcion: act.Descripcion,
        solucion:    solucion || null,
        estado
      });
      console.log(`📧 Correo enviado — ${asunto}`);
    } catch (mailErr) {
      console.warn('⚠ Correo no enviado:', mailErr.message);
    }

    res.json({ mensaje: 'Actividad actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/actividades/:id — eliminar
app.delete('/api/actividades/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const info = await pool.request()
      .input('ID', sql.Int, id)
      .query('SELECT * FROM Actividades WHERE ActividadID = @ID');
    const act = info.recordset[0];

    await pool.request()
      .input('ID', sql.Int, id)
      .query('DELETE FROM Actividades WHERE ActividadID = @ID');

    try {
      await enviarCorreo({
        tipo: 'eliminada',
        asunto: `Actividad eliminada: ${act.Titulo}`,
        ticket:      act.NumeroTicket,
        titulo:      act.Titulo,
        categoria:   act.Categoria,
        prioridad:   act.Prioridad,
        hora:        act.HoraProgramada,
        descripcion: act.Descripcion,
        estado:      'Eliminada'
      });
      console.log(`📧 Correo enviado — Eliminada: ${act.Titulo}`);
    } catch (mailErr) {
      console.warn('⚠ Correo no enviado:', mailErr.message);
    }

    res.json({ mensaje: 'Actividad eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ─── MIDDLEWARE AUTH ──────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No autorizado' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ─── FUNCIÓN GENERAR CONTRASEÑA ──────────────
function generarPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  let pass = '';
  for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

// ─── USUARIOS ────────────────────────────────

// POST /api/auth/registro — crear usuario
app.post('/api/auth/registro', async (req, res) => {
  const { nombre, apellidos, area, correo } = req.body;
  if (!nombre || !apellidos || !area || !correo)
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });

  try {
    // Verificar si ya existe
    const existe = await pool.request()
      .input('Correo', sql.NVarChar(150), correo.toLowerCase())
      .query('SELECT UsuarioID FROM Usuarios WHERE Correo = @Correo');

    if (existe.recordset.length > 0)
      return res.status(400).json({ error: 'Ya existe una cuenta con ese correo' });

    // Generar y hashear contraseña
    const passPlana = generarPassword();
    const passHash  = await bcrypt.hash(passPlana, 10);

    await pool.request()
      .input('Nombre',    sql.NVarChar(100), nombre.trim())
      .input('Apellidos', sql.NVarChar(100), apellidos.trim())
      .input('Area',      sql.NVarChar(100), area.trim())
      .input('Correo',    sql.NVarChar(150), correo.toLowerCase().trim())
      .input('Password',  sql.NVarChar(255), passHash)
      .query('INSERT INTO Usuarios (Nombre, Apellidos, Area, Correo, Password) VALUES (@Nombre, @Apellidos, @Area, @Correo, @Password)');

    // Enviar correo con credenciales
    await transporter.sendMail({
      from: '"Diario de Actividades" <soporte.imedmex@gmail.com>',
      to:   correo,
      subject: '🔐 Tu cuenta ha sido creada — Diario de Actividades',
      html: `
      <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#f5f0e8;border:1px solid #d4c9b0;">
        <div style="background:#0f1f3d;color:white;padding:24px 32px;">
          <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px;opacity:0.6;">Diario de Actividades</p>
          <h1 style="margin:0;font-size:22px;font-weight:400;">🔐 Bienvenido al sistema</h1>
        </div>
        <div style="padding:32px;">
          <p style="font-size:14px;color:#374151;margin-bottom:20px;">Hola <strong>${nombre} ${apellidos}</strong>, tu cuenta ha sido creada exitosamente.</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;color:#8a7f6e;width:130px;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Nombre</td>
              <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;font-weight:bold;">${nombre} ${apellidos}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;color:#8a7f6e;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Área</td>
              <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;">${area}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;color:#8a7f6e;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Correo</td>
              <td style="padding:10px 0;border-bottom:1px solid #d4c9b0;">${correo}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#8a7f6e;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Contraseña</td>
              <td style="padding:10px 0;font-size:18px;font-weight:bold;color:#0f1f3d;letter-spacing:2px;">${passPlana}</td>
            </tr>
          </table>
          <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px 16px;margin-top:20px;font-size:12px;color:#856404;">
            ⚠️ Por seguridad, guarda tu contraseña en un lugar seguro.
          </div>
        </div>
        <div style="background:#ede7d3;padding:14px 32px;font-size:11px;color:#8a7f6e;">
          Sistema de Registro · DESKTOP-GICH9VN
        </div>
      </div>`
    });

    res.json({ mensaje: 'Cuenta creada. Revisa tu correo para obtener tu contraseña.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { correo, password } = req.body;
  if (!correo || !password)
    return res.status(400).json({ error: 'Correo y contraseña requeridos' });

  try {
    const result = await pool.request()
      .input('Correo', sql.NVarChar(150), correo.toLowerCase())
      .query('SELECT * FROM Usuarios WHERE Correo = @Correo AND Activo = 1');

    if (!result.recordset.length)
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });

    const user = result.recordset[0];
    const valid = await bcrypt.compare(password, user.Password);
    if (!valid)
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });

    // Actualizar último acceso
    await pool.request()
      .input('ID', sql.Int, user.UsuarioID)
      .query('UPDATE Usuarios SET UltimoAcceso = GETDATE() WHERE UsuarioID = @ID');

    const token = jwt.sign(
      { id: user.UsuarioID, nombre: user.Nombre, apellidos: user.Apellidos, area: user.Area, correo: user.Correo },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: { nombre: user.Nombre, apellidos: user.Apellidos, area: user.Area, correo: user.Correo }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CATEGORÍAS ──────────────────────────────

// GET /api/categorias
app.get('/api/categorias', authMiddleware, async (req, res) => {
  try {
    const result = await pool.request().query(
      'SELECT CategoriaID AS id, Nombre AS nombre, Icono AS icono FROM Categorias ORDER BY Nombre'
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/categorias — crear
app.post('/api/categorias', authMiddleware, async (req, res) => {
  const { nombre, icono } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const result = await pool.request()
      .input('Nombre', sql.NVarChar(50), nombre.trim())
      .input('Icono',  sql.NVarChar(10), icono || '📌')
      .query(`
        INSERT INTO Categorias (Nombre, Icono)
        OUTPUT INSERTED.CategoriaID
        VALUES (@Nombre, @Icono)
      `);
    res.json({ id: result.recordset[0].CategoriaID, mensaje: 'Categoría creada' });
  } catch (err) {
    if (err.message.includes('UNIQUE') || err.message.includes('unique')) {
      return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/categorias/:id — editar
app.put('/api/categorias/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { nombre, icono } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    await pool.request()
      .input('Nombre', sql.NVarChar(50), nombre.trim())
      .input('Icono',  sql.NVarChar(10), icono || '📌')
      .input('ID',     sql.Int,          id)
      .query('UPDATE Categorias SET Nombre=@Nombre, Icono=@Icono WHERE CategoriaID=@ID');
    res.json({ mensaje: 'Categoría actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/categorias/:id — eliminar
app.delete('/api/categorias/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    // Verificar si hay actividades usando esta categoría
    const check = await pool.request()
      .input('ID', sql.Int, id)
      .query(`
        SELECT COUNT(*) AS total FROM Actividades a
        JOIN Categorias c ON a.Categoria = c.Nombre
        WHERE c.CategoriaID = @ID
      `);
    if (check.recordset[0].total > 0) {
      return res.status(400).json({ error: 'No se puede eliminar: hay actividades usando esta categoría' });
    }
    await pool.request()
      .input('ID', sql.Int, id)
      .query('DELETE FROM Categorias WHERE CategoriaID = @ID');
    res.json({ mensaje: 'Categoría eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/actividades/buscar?q=TI#2600001
app.get('/api/buscar', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  try {
    const result = await pool.request()
      .input('q', sql.NVarChar(200), `%${q}%`)
      .query(`
        SELECT
          ActividadID   AS id,
          NumeroTicket  AS ticket,
          Titulo        AS titulo,
          Descripcion   AS descripcion,
          Categoria     AS categoria,
          Prioridad     AS prioridad,
          CONVERT(VARCHAR(5), HoraProgramada, 108) AS hora,
          Estado        AS estado,
          Solucion      AS solucion,
          FechaRegistro AS fecha
        FROM Actividades
        WHERE NumeroTicket LIKE @q
           OR Titulo       LIKE @q
           OR Descripcion  LIKE @q
        ORDER BY FechaRegistro DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN Estado = 'Pendiente'  THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN Estado = 'Completada' THEN 1 ELSE 0 END) AS completadas,
        SUM(CASE WHEN Prioridad = 'Alta'    THEN 1 ELSE 0 END) AS alta
      FROM Actividades
      WHERE FechaRegistro = CAST(GETDATE() AS DATE)
    `);
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── INICIAR ─────────────────────────────────
conectar().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📧 Notificaciones → ${CORREO_DESTINO}\n`);
  });
});
