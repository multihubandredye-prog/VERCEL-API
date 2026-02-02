const axios = require('axios');

module.exports = async (req, res) => {
    const { phone } = req.query;
    const FIREBASE_KEY = process.env.FIREBASE_KEY;
    const FIREBASE_URL = `https://firestore.googleapis.com/v1/projects/projects-general-fed41/databases/(default)/documents/users?key=${FIREBASE_KEY}`;

    if (!phone) return res.status(400).json({ error: "Telefone ausente" });

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
        res.status(500).json({ error: "Erro na ponte" });
    }
};
