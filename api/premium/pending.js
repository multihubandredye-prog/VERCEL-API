const { setCors, listUsers, isAdminRequest } = require('../_premium');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isAdminRequest(req)) return res.status(403).json({ success: false, error: 'Chave administrativa inválida' });

  try {
    const users = await listUsers();
    const pending = users
      .map(u => ({ id: u.id, ...u.data }))
      .filter(u => String(u.status || '').toLowerCase() === 'pending_activation')
      .sort((a, b) => String(b.lastRequestAt || '').localeCompare(String(a.lastRequestAt || '')));
    return res.status(200).json({ success: true, count: pending.length, data: pending });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Erro ao listar solicitações pendentes' });
  }
};
