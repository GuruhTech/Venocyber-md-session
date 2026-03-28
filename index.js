import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
global.__path = __dirname;

const PORT = process.env.PORT || 8000;

// Dynamic imports for the other files
let server, code;

// Import the other files dynamically
const loadModules = async () => {
    server = (await import('./qr.js')).default;
    code = (await import('./pair.js')).default;
    
    app.use('/qr', server);
    app.use('/code', code);
};

loadModules();

import('events').then(events => {
    events.EventEmitter.defaultMaxListeners = 500;
});

app.use('/pair', async (req, res, next) => {
    res.sendFile(join(__path, 'pair.html'));
});

app.use('/', async (req, res, next) => {
    res.sendFile(join(__path, 'main.html'));
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(PORT, () => {
    console.log(`
Don't Forgot To Give Star

 Server running on http://localhost:` + PORT);
});

export default app;
