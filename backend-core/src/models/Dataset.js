const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  description: { type: String, default: '' }
}, { _id: false });

const tableSchema = new mongoose.Schema({
  tableName: { type: String, required: true },
  description: { type: String, default: '' },
  originalFileName: { type: String, required: true },
  gcsParquetPath: { type: String, required: true },
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
