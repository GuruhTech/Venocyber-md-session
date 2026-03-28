import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

// Ensure temp directory exists
const tempDir = join(__dirname, 'temp');
if (!existsSync(tempDir)) mkdirSync(tempDir);

// Simple HTML form
const htmlForm = `
<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp Session Generator</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #25D366;
            text-align: center;
            margin-bottom: 30px;
            font-size: 28px;
        }
        input {
            width: 100%;
            padding: 15px;
            font-size: 16px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            margin-bottom: 15px;
            transition: border-color 0.3s;
        }
        input:focus {
            outline: none;
            border-color: #25D366;
        }
        button {
            width: 100%;
            padding: 15px;
            background: #25D366;
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s, background 0.2s;
        }
        button:hover {
            background: #128C7E;
            transform: translateY(-2px);
        }
        button:active {
            transform: translateY(0);
        }
        #result {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
            display: none;
            word-break: break-all;
        }
        .loading {
            text-align: center;
            margin-top: 20px;
            display: none;
            color: #666;
        }
        .code {
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            color: #25D366;
            letter-spacing: 2px;
        }
        textarea {
            width: 100%;
            margin-top: 10px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 WhatsApp Session Generator</h1>
        <form id="form">
            <input type="text" id="phone" placeholder="Enter phone number (e.g., 254712345678)" required>
            <button type="submit">Generate Session</button>
        </form>
        <div class="loading" id="loading">⏳ Generating session... Please wait 30-60 seconds...</div>
        <div id="result"></div>
    </div>
    <script>
        document.getElementById('form').onsubmit = async (e) => {
            e.preventDefault();
            const phone = document.getElementById('phone').value;
            const loading = document.getElementById('loading');
            const result = document.getElementById('result');
            
            loading.style.display = 'block';
            result.style.display = 'none';
            
            try {
                const response = await fetch('/generate?phone=' + encodeURIComponent(phone));
                const data = await response.json();
                loading.style.display = 'none';
                result.style.display = 'block';
                
                if (data.code) {
                    result.innerHTML = '<strong>📱 Pairing Code:</strong><div class="code">' + data.code + '</div><br><small>Enter this code in WhatsApp > Settings > Linked Devices > Link a Device</small>';
                } else if (data.session) {
                    result.innerHTML = '<strong>✅ Session Generated Successfully!</strong><br><br><strong>Base64 Session String:</strong><textarea rows="5" readonly>' + data.session + '</textarea><br><small>Copy this string and use it in your bot</small>';
                } else if (data.error) {
                    result.innerHTML = '<strong>❌ Error:</strong><br>' + data.error;
                }
            } catch (error) {
                loading.style.display = 'none';
                result.style.display = 'block';
                result.innerHTML = '<strong>❌ Error:</strong><br>' + error.message;
            }
        };
    </script>
</body>
</html>
`;

app.get('/', (req, res) => {
    res.send(htmlForm);
});

app.get('/generate', async (req, res) => {
    const phone = req.query.phone;
    
    if (!phone) {
        return res.json({ error: 'Phone number required' });
    }
    
    const sessionId = Date.now().toString();
    const authPath = join(tempDir, sessionId);
    
    try {
        const { default: makeWASocket, useMultiFileAuthState, Browsers } = await import('@whiskeysockets/baileys');
        
        // Create auth folder
        if (!existsSync(authPath)) mkdirSync(authPath);
        
        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: {
                level: 'silent',
                child: () => ({ level: 'silent' })
            },
            browser: Browsers.macOS('Desktop'),
            markOnlineOnConnect: false
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        let pairingCode = null;
        let sessionString = null;
        
        // Send pairing code immediately
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        
        // Request pairing code after connection
        setTimeout(async () => {
            try {
                pairingCode = await sock.requestPairingCode(cleanPhone);
                res.json({ code: pairingCode });
            } catch (err) {
                console.error('Pairing error:', err);
            }
        }, 2000);
        
        // Wait for successful connection
        const connectionPromise = new Promise((resolve) => {
            sock.ev.on('connection.update', async (update) => {
                if (update.connection === 'open') {
                    // Connection successful, read the creds file
                    setTimeout(() => {
                        const credsPath = join(authPath, 'creds.json');
                        if (existsSync(credsPath)) {
                            const credsData = readFileSync(credsPath);
                            sessionString = Buffer.from(credsData).toString('base64');
                            
                            // Send session to WhatsApp
                            sock.sendMessage(sock.user.id, {
                                text: `✅ *Session Generated Successfully!*\n\n*Base64 Session:*\n\`\`\`${sessionString}\`\`\`\n\nSave this string for your bot.`
                            }).catch(() => {});
                            
                            resolve(sessionString);
                            
                            // Clean up after 10 seconds
                            setTimeout(() => {
                                sock.ws.close();
                                try { rmSync(authPath, { recursive: true, force: true }); } catch(e) {}
                            }, 10000);
                        }
                    }, 3000);
                }
            });
        });
        
        // Wait for connection or timeout
        const session = await Promise.race([
            connectionPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for connection')), 90000))
        ]);
        
        // If we have session and already sent code, update response
        if (session && pairingCode) {
            // Don't override the code response
        }
        
    } catch (error) {
        console.error('Generation error:', error);
        if (!res.headersSent) {
            res.json({ error: error.message || 'Failed to generate session' });
        }
        // Clean up
        try { rmSync(authPath, { recursive: true, force: true }); } catch(e) {}
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});

export default app;
server.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});

export default app;
