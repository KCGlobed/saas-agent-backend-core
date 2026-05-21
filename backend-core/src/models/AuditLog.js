const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: { type: String },
  action: { type: String, required: true },
  method: { type: String },
  endpoint: { type: String },
  status: { type: String, enum: ['SUCCESS', 'ERROR'] },
  statusCode: { type: Number },
  payload: { type: mongoose.Schema.Types.Mixed },
  response: { type: mongoose.Schema.Types.Mixed },
  errorMessage: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
