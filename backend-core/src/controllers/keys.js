const ApiKey = require('../models/ApiKey');

exports.saveKey = async (req, res) => {
  try {
    const { provider, key } = req.body;
    
    // Check if key already exists for this provider and user
    let apiKey = await ApiKey.findOne({ user: req.user.id, provider });
    
    if (apiKey) {
      apiKey.key = key; // The pre-save hook will encrypt this
      await apiKey.save();
    } else {
      apiKey = new ApiKey({ user: req.user.id, provider, key });
      await apiKey.save();
    }

    res.json({ message: 'API Key saved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getKeys = async (req, res) => {
  try {
    const keys = await ApiKey.find({ user: req.user.id }).select('provider createdAt updatedAt');
    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
