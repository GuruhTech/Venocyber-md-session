import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import events from 'events';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __path = __dirname;

const PORT = process.env.PORT || 8000;

// Increase max listeners
events.EventEmitter.defaultMaxListeners = 500;

// Import routes dynamically
let server, code;

// Load the modules
const loadModules = async () => {
    try {
        server = (await import('./qr.js')).default;
        code = (await import('./pair.js')).default;
        
        app.use('/qr', server);
        app.use('/code', code);
    } catch (error) {
        console.error('Error loading modules:', error);
    }
};

loadModules();

// Serve HTML files
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
