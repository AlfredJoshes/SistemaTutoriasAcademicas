const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// Necesario para que la bitacora guarde la IP real cuando hay un proxy delante
app.set('trust proxy', true);

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

module.exports = app;
