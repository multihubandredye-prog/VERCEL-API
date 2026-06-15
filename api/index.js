const https = require('https');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const phone = req.query.phone;
  const FIREBASE_KEY = process.env.FIREBASE_KEY;

  // Resposta padrão sem número
  if (!phone) {
    return res.end(JSON.stringify({ status: "API ONLINE | WCA CONNECT" }));
  }

  // Consulta exata para o Firestore
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
    let dadosBrutos = '';
    resp.on('data', pedaco => dadosBrutos += pedaco);
    resp.on('end', () => {
      try {
        const resultado = JSON.parse(dadosBrutos);

        // ✅ VERIFICA E LÊ EXATAMENTE COMO O FIRESTORE DEVOLVE
        if (!Array.isArray(resultado) || resultado.length === 0 || !resultado[0].document) {
          return res.end(JSON.stringify({ status: "bloqueado" }));
        }

        const campos = resultado[0].document.fields;

        // Pega os valores com segurança
        const nome = campos?.name?.stringValue?.trim() || '';
        const vip = campos?.vip?.booleanValue === true;
        const expiracao = campos?.project_expiration?.stringValue?.trim() || '';

        // Valida todas as condições
        if (nome !== '' && vip === true && expiracao !== '') {
          return res.end(JSON.stringify({
            nome: nome,
            expiracao: expiracao,
            status: "ativo"
          }));
        }

        return res.end(JSON.stringify({ status: "bloqueado" }));

      } catch (erro) {
        return res.end(JSON.stringify({
          status: "erro_servidor",
          detalhe: erro.message,
          retorno_bruto: dadosBrutos
        }));
      }
    });
  }).on('error', () => {
    return res.end(JSON.stringify({ status: "erro_conexao" }));
  });
};
