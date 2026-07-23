const { setCors, normalizePhone, getUserByPhone, publicStatusFromUser } = require('./_premium');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const phone = normalizePhone(req.query.phone);
  if (!phone) return res.end(JSON.stringify({ status: 'API ONLINE | WCA CONNECT' }));

  try {
    const user = await getUserByPhone(phone);
    return res.end(JSON.stringify(publicStatusFromUser(user)));
  } catch (err) {
    return res.end(JSON.stringify({ status: 'teste', plano: 'teste', tipo: 'evaluation', modo: 'TESTE' }));
  }
};
