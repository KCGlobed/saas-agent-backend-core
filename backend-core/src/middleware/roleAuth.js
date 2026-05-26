const User = require('../models/User');

exports.superadminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied: Superadmin role required' });
    }
    // Attach full user object if needed later
    req.fullUser = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
