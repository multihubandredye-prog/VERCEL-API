const { setCors, readBody, normalizePhone, deleteUserByPhone, isAdminRequest } = require('../_premium');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const body = req.method === 'POST' ? await readBody(req) : {};
  req.body = body;

  if (!isAdminRequest(req)) {
    return res.status(403).json({ success: false, error: 'Chave administrativa inválida' });
  }

  try {
    const phone = normalizePhone(body.phone || req.query.phone);
    if (!phone || phone.length < 8) {
      return res.status(400).json({ success: false, error: 'Número de telefone inválido' });
    }

    const result = await deleteUserByPhone(phone);
    if (!result.found) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
        phone
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Usuário Premium removido com sucesso.',
      phone,
      documentId: result.id,
      deleted: true
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Erro ao remover usuário Premium' });
  }
};
