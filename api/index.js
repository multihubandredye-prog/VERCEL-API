const axios = require('axios');

module.exports = async (req, res) => {
    const { phone } = req.query;
    const FIREBASE_KEY = process.env.FIREBASE_KEY;
    const FIREBASE_URL = `https://firestore.googleapis.com/v1/projects/projects-general-fed41/databases/(default)/documents/users?key=${FIREBASE_KEY}`;

    // --- INTERFACE PROFISSIONAL PARA NAVEGADOR ---
    if (!phone) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(`
            <!DOCTYPE html>
            <html lang="pt-br">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>WHATS-CONNECT-API System | API Status</title>
                <style>
                    body { font-family: sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .card { background: #1e293b; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); text-align: center; border-top: 4px solid #10b981; }
                    .status { color: #10b981; font-weight: bold; margin-top: 10px; }
                    .info { color: #94a3b8; font-size: 0.9rem; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2> WHATS-CONNECT-API</h2>
                    <div class="status">● SISTEMA OPERACIONAL</div>
                    <p class="info">Ativo</p>
                </div>
            </body>
            </html>
        `);
    }

    // --- LÓGICA DE DADOS PARA O TERMUX ---
    try {
        const response = await axios.get(FIREBASE_URL);
        const docs = response.data.documents || [];
        const user = docs.find(d => d.fields.phone && d.fields.phone.stringValue === phone);

        if (!user) return res.status(404).json({ status: "bloqueado" });

        res.status(200).json({
            nome: user.fields.name.stringValue,
            expiracao: user.fields.project_expiration.stringValue,
            status: "ativo"
        });
    } catch (e) {
        res.status(500).json({ error: "Erro na conexão com o banco de dados" });
    }
};
