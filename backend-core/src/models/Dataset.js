const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  description: { type: String, default: '' }
}, { _id: false });

const tableSchema = new mongoose.Schema({
  tableName: { type: String, required: true },
  description: { type: String, default: '' },
  originalFileName: { type: String },
  gcsParquetPath: { type: String },
  
  sourceType: {
    type: String,
    enum: ['file', 'google_sheet', 'postgresql', 'mysql', 'mongodb'],
    default: 'file'
  },
  queryMode: {
    type: String,
    enum: ['live', 'snapshot'],
    default: 'live'
  },
  sourceConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  syncStatus: { type: String, enum: ['pending', 'syncing', 'synced', 'error'] },
  syncProgress: { type: Number, default: 0 },
  lastSyncedAt: { type: Date },
  syncError: { type: String },

  rowCount: { type: Number, default: 0 },
  columns: [columnSchema]
});

const datasetSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  tables: [tableSchema]
}, { timestamps: true });

module.exports = mongoose.model('Dataset', datasetSchema);
