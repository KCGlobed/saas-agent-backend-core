const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: false },
  email: { type: String, required: false },
  phone: { type: String, required: false },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);
