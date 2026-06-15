const https = require('https');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const phone = req.query.phone;
  const FIREBASE_KEY = process.env.FIREBASE_KEY || '';

  if (!phone) {
    return res.end(JSON.stringify({ status: "API ONLINE | WCA CONNECT" }));
  }

  const query = JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: "users" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "phone" },
          op: "EQUAL",
          value: { stringValue: phone }
        }
      },
      limit: 1
    }
  });

  const url = `https://firestore.googleapis.com/v1/projects/projects-general-fed41/databases/(default)/documents:runQuery?key=${FIREBASE_KEY}&query=${encodeURIComponent(query)}`;

  https.get(url, (resp) => {
    let data = '';
    resp.on('data', chunk => data += chunk);
    resp.on('end', () => {
      try {
        const resultado = JSON.parse(data);
        const documento = resultado[0]?.document?.fields;

        if (documento && documento.name?.stringValue) {
          const vip = documento.vip?.booleanValue || false;
          const expira = documento.project_expiration?.stringValue || '';

          if (vip && expira) {
            return res.end(JSON.stringify({
              nome: documento.name.stringValue,
              expiracao: expira,
              status: "ativo"
            }));
          }
        }

        res.end(JSON.stringify({ status: "bloqueado" }));
      } catch (err) {
        res.end(JSON.stringify({ status: "erro_resposta" }));
      }
    });
  }).on('error', () => {
    res.end(JSON.stringify({ status: "erro_servidor" }));
  });
};
