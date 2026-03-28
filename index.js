import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

// Serve HTML form
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Session Generator</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: 50px auto;
                    padding: 20px;
                    background: #f0f2f5;
                }
                .container {
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                h1 { color: #25D366; text-align: center; }
                input, button {
                    width: 100%;
                    padding: 12px;
                    margin: 10px 0;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    font-size: 16px;
                }
                button {
                    background: #25D366;
                    color: white;
                    border: none;
                    cursor: pointer;
                }
                button:hover { background: #128C7E; }
                #result {
                    margin-top: 20px;
                    padding: 10px;
                    background: #f8f9fa;
                    border-radius: 5px;
                    word-break: break-all;
                }
                .loading { display: none; text-align: center; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 WhatsApp Session Generator</h1>
                <form id="pairForm">
                    <input type="text" id="phone" placeholder="Enter phone number (e.g., 254712345678)" required>
                    <button type="submit">Generate Session</button>
                </form>
                <div class="loading" id="loading">⏳ Generating session... Please wait...</div>
                <div id="result"></div>
            </div>
            <script>
                document.getElementById('pairForm').onsubmit = async (e) => {
                    e.preventDefault();
                    const phone = document.getElementById('phone').value;
                    const loading = document.getElementById('loading');
                    const result = document.getElementById('result');
                    
                    loading.style.display = 'block';
                    result.innerHTML = '';
                    
                    try {
                        const response = await fetch('/pair?number=' + phone);
                        const data = await response.json();
                        loading.style.display = 'none';
                        
                        if (data.code) {
                            result.innerHTML = '<strong>✅ Pairing Code:</strong><br><code style="font-size:20px;">' + data.code + '</code><br><br>Enter this code in WhatsApp > Linked Devices';
                        } else if (data.session) {
                            result.innerHTML = '<strong>✅ Session ID (Base64):</strong><br><textarea rows="5" style="width:100%">' + data.session + '</textarea><br><br>Save this string for your bot!';
                        } else if (data.error) {
                            result.innerHTML = '<strong>❌ Error:</strong><br>' + data.error;
                        }
                    } catch (error) {
                        loading.style.display = 'none';
                        result.innerHTML = '<strong>❌ Error:</strong><br>' + error.message;
                    }
                };
            </script>
        </body>
        </html>
    `);
});

// Pairing endpoint
app.get('/pair', async (req, res) => {
    const number = req.query.number;
    
    if (!number) {
        return res.json({ error: 'Phone number required' });
    }
    
    try {
        const { default: makeWASocket, useMultiFileAuthState, Browsers } = await import('@whiskeysockets/baileys');
        const pino = (await import('pino')).default;
        
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS('Desktop'),
            markOnlineOnConnect: false
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        let pairingCode = null;
        let sessionData = null;
        
        // Wait for connection and get pairing code
        const waitForPairing = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 60000);
            
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (connection === 'open') {
                    clearTimeout(timeout);
                    // Send session to WhatsApp
                    const fs = await import('fs');
                    const credsPath = './auth_info/creds.json';
                    
                    if (fs.existsSync(credsPath)) {
                        const data = fs.readFileSync(credsPath);
                        const sessionBase64 = Buffer.from(data).toString('base64');
                        sessionData = sessionBase64;
                        
                        // Send session to user
                        await sock.sendMessage(sock.user.id, { 
                            text: `✅ *Your Session ID (Base64):*\n\n\`\`\`${sessionBase64}\`\`\`\n\nSave this string for your bot!` 
                        });
                    }
                    
                    resolve({ code: pairingCode, session: sessionData });
                    
                    setTimeout(() => {
                        sock.ws.close();
                    }, 3000);
                } else if (connection === 'close') {
                    clearTimeout(timeout);
                    reject(new Error('Connection closed'));
                }
            });
            
            // Request pairing code
            setTimeout(async () => {
                try {
                    const cleanNumber = number.replace(/[^0-9]/g, '');
                    pairingCode = await sock.requestPairingCode(cleanNumber);
                    if (pairingCode) {
                        res.json({ code: pairingCode });
                    }
                } catch (err) {
                    reject(err);
                }
            }, 2000);
        });
        
        const result = await waitForPairing;
        if (result.session) {
            res.json({ session: result.session });
        }
        
    } catch (error) {
        console.error('Error:', error);
        res.json({ error: error.message || 'Failed to generate session' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const server = createServer(app);

server.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});

export default app;
