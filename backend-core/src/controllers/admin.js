const User = require('../models/User');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, permissions } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (role) user.role = role;
    if (permissions) {
      user.permissions = {
        ...user.permissions.toObject(),
        ...permissions
      };
    }

    await user.save();

    res.json({ message: 'User updated successfully', user: { id: user._id, name: user.name, email: user.email, role: user.role, permissions: user.permissions } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
