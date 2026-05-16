const mongoose = require('mongoose');

const toolCallSchema = new mongoose.Schema({
  name: { type: String },
  params: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const citationSchema = new mongoose.Schema({
  source: { type: String },
  filename: { type: String }
}, { _id: false });

const chatLogSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  query: { type: String, required: true },
  response: { type: String, required: true },
  provider: { type: String },
  model: { type: String },
  latencyMs: { type: Number },
  hasRagHits: { type: Boolean, default: false },
  citations: { type: [citationSchema], default: [] },
  toolCallsMade: { type: [toolCallSchema], default: [] },
  // Accuracy score: 0-100 (LLM self-evaluation), or null if N/A
  accuracyScore: { type: Number, default: null },
  accuracyNote: { type: String, default: null },
}, {
  timestamps: true,
  // TTL index: logs auto-delete after 90 days. Change expireAfterSeconds to adjust.
  // Set to 0 or remove the index to keep forever.
});

// TTL index — auto-purge logs after 90 days
chatLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('ChatLog', chatLogSchema);
