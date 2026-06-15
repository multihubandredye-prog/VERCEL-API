const https = require('https');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const phone = req.query.phone;
  const FIREBASE_KEY = process.env.FIREBASE_KEY;

  if (!phone) {
    return res.end(JSON.stringify({ status: "API ONLINE | WCA CONNECT" }));
  }

  // ✅ USA A MESMA ROTA QUE VOCÊ USA MANUALMENTE
  const url = `https://firestore.googleapis.com/v1/projects/projects-general-fed41/databases/(default)/documents/users?key=${FIREBASE_KEY}`;

  https.get(url, (resp) => {
    let data = '';
    resp.on('data', chunk => data += chunk);
    resp.on('end', () => {
      try {
        const resposta = JSON.parse(data);

        // ✅ Percorre a lista para encontrar o número exato
        if (resposta && resposta.documents && Array.isArray(resposta.documents)) {
          const usuario = resposta.documents.find(doc => 
            doc.fields?.phone?.stringValue === phone
          );

          if (usuario) {
            const campos = usuario.fields;
            return res.end(JSON.stringify({
              nome: campos.name.stringValue,
              expiracao: campos.project_expiration.stringValue,
              status: "ativo"
            }));
          }
        }

        // Se não encontrou = bloqueado
        return res.end(JSON.stringify({ status: "bloqueado" }));

      } catch (err) {
        return res.end(JSON.stringify({ status: "bloqueado" }));
      }
    });
  }).on('error', () => {
    return res.end(JSON.stringify({ status: "bloqueado" }));
  });
};
