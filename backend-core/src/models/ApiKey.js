const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/crypto');
const apiKeySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: String, enum: ['openai', 'claude', 'llama'], required: true },
  key: { type: String, required: true },
}, { timestamps: true });

// Ensure unique provider key per user
apiKeySchema.index({ user: 1, provider: 1 }, { unique: true });

// Pre-save hook to encrypt key
apiKeySchema.pre('save', function(next) {
  if (this.isModified('key')) {
    this.key = encrypt(this.key);
  }
  next();
});

// Method to decrypt key
apiKeySchema.methods.getDecryptedKey = function() {
  return decrypt(this.key);
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
