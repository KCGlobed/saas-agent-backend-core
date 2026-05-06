const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['file', 'url', 'text'], required: true },
  originalName: { type: String, required: true }, // filename, url, or "Raw Text"
  mimeType: { type: String, default: 'text/plain' },
  sizeBytes: { type: Number, default: 0 },
  gcsPath: { type: String, default: null },      // e.g., "projects/abc/resources/uuid.pdf"
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'], 
    default: 'pending' 
  },
  jobId: { type: String, default: null },        // FastAPI background job ID
  chunkCount: { type: Number, default: 0 },
  preview: { type: String, default: '' },        // First 500 chars of extracted text
  errorMessage: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Resource', resourceSchema);
