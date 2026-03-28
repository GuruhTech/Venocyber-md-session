import { makeid } from './id.js';
import QRCode from 'qrcode';
import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Venocyber_Tech, { 
    useMultiFileAuthState,
    delay,
    Browsers
} from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, {
        recursive: true,
        force: true
    });
}

router.get('/', async (req, res) => {
    const id = makeid();
    
    async function VENOCYBER_MD_QR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            let Qr_Code_By_Venocyber_Tech = Venocyber_Tech({
                auth: state,
                printQRInTerminal: false,
                logger: pino({
                    level: "silent"
                }),
                browser: Browsers.macOS("Desktop"),
            });

            Qr_Code_By_Venocyber_Tech.ev.on('creds.update', saveCreds);
            Qr_Code_By_Venocyber_Tech.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;
                if (qr) await res.end(await QRCode.toBuffer(qr));
                if (connection == "open") {
                    await delay(5000);
                    let data = fs.readFileSync(__dirname + `/temp/${id}/creds.json`);
                    await delay(800);
                    let b64data = Buffer.from(data).toString('base64');
                    let session = await Qr_Code_By_Venocyber_Tech.sendMessage(Qr_Code_By_Venocyber_Tech.user.id, { text: '' + b64data });

                    let VENOCYBER_MD_TEXT = `
*_Qr Code By Venocyber Tech_*
*_Made With 🤍_*
______________________________________
*_Pair Code Connected by Venocyber Tech_*
*_Made With 🤍_*
______________________________________
╔════◇
║ *『 WOW YOU CHOOSEN VENOCYBER-MD 』*
║ _You Have Completed the First Step to Deploy a Whatsapp Bot._
╚══════════════════════╝
╔═════◇
║  『••• 𝗩𝗶𝘀𝗶𝘁 𝗙𝗼𝗿 𝗛𝗲𝗹𝗽 •••』
║❒ *Ytube:* _youtube.com/@JASTINMTEWA-vn9pl_
║❒ *Owner:* _https://wa.me/message/A4QG2JZKBXFTN1_
║❒ *Repo:* _https://github.com/Kingjux/venocyber-md_
║❒ *WaGroup:* _https://chat.whatsapp.com/HSln3blDuuuKvC8njxyCCN_
║❒ *WaChannel:* _https://whatsapp.com/channel/0029VaYauR9ISTkHTj4xvi1l_
║❒ *Plugins:* _https://github.com/Kingjux/venocyber-md-plugins_
╚══════════════════════╝ 
_____________________________________
    
_Don't Forget To Give Star To My Repo_`;
                    
                    await Qr_Code_By_Venocyber_Tech.sendMessage(Qr_Code_By_Venocyber_Tech.user.id, { text: VENOCYBER_MD_TEXT }, { quoted: session });

                    await delay(100);
                    await Qr_Code_By_Venocyber_Tech.ws.close();
                    return await removeFile("temp/" + id);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    VENOCYBER_MD_QR_CODE();
                }
            });
        } catch (err) {
            if (!res.headersSent) {
                await res.json({
                    code: "Service is Currently Unavailable"
                });
            }
            console.log(err);
            await removeFile("temp/" + id);
        }
    }
    return await VENOCYBER_MD_QR_CODE();
});

export default router;
