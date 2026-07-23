const { setCors, normalizePhone, getUserByPhone, isAdminRequest, publicStatusFromUser } = require('../_premium');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isAdminRequest(req)) return res.status(403).json({ success: false, error: 'Chave administrativa inválida' });

  try {
    const phone = normalizePhone(req.query.phone);
    if (!phone) return res.status(400).json({ success: false, error: 'Número obrigatório' });
    const user = await getUserByPhone(phone);
    return res.status(200).json({ success: true, phone, publicStatus: publicStatusFromUser(user), user: user ? user.data : null });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Erro ao consultar usuário' });
  }
};
