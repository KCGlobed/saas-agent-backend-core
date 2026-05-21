const mongoose = require('mongoose');

const oauthTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: String, default: 'google' },
  encryptedToken: { type: String }, // JSON string containing tokens, encrypted
  userEmail: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('OAuthToken', oauthTokenSchema);
