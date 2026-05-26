const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'superadmin'], default: 'user' },
  permissions: {
    canSetWidgetSettings: { type: Boolean, default: false },
    canIngestSources: { type: Boolean, default: false },
    projectsLimit: { type: Number, default: 3 },
    canConnectDB: { type: Boolean, default: false },
    canUploadCSV: { type: Boolean, default: false },
    canApiIntegration: { type: Boolean, default: false },
    canViewLogs: { type: Boolean, default: false },
    canEngineSettings: { type: Boolean, default: false },
    canAccessDatasets: { type: Boolean, default: false },
    canWebScraping: { type: Boolean, default: false },
    canWidgetDesigner: { type: Boolean, default: false }
  },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
