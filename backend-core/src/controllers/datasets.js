const Dataset = require('../models/Dataset');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8001/api';
console.log(FASTAPI_URL, '---FASTAPI_URL')
exports.getDatasets = async (req, res) => {
  try {
    const datasets = await Dataset.find({ projectId: req.params.id });
    res.json(datasets);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching datasets' });
  }
};

exports.uploadDatasetFiles = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { name, description } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const tables = [];

    // Send each file to the Python backend to process, convert to Parquet, and upload to GCS
    for (const file of req.files) {
      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append('file', file.buffer, file.originalname);

      const response = await axios.post(`${FASTAPI_URL}/datasets/process`, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });

      const schema = response.data;

      // Auto-generate a safe table name from the file name
      const tableName = file.originalname
        .split('.')[0]
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase() + '_' + Date.now().toString().slice(-4);

      tables.push({
        tableName: tableName,
        description: '',
        originalFileName: schema.originalFileName,
        gcsParquetPath: schema.gcsParquetPath,
        rowCount: schema.rowCount,
        columns: schema.columns
      });
    }

    const dataset = await Dataset.create({
      projectId,
      name: name || 'Untitled Dataset',
      description: description || '',
      tables
    });

    res.status(201).json(dataset);
  } catch (error) {
    console.error('Error uploading dataset files:', error.message);
    res.status(500).json({ error: 'Failed to process dataset upload' });
  }
};

exports.updateDataset = async (req, res) => {
  try {
    const { id: projectId, datasetId } = req.params;
    const { name, description, tables } = req.body;

    const dataset = await Dataset.findOne({ _id: datasetId, projectId });
    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    if (name) dataset.name = name;
    if (description !== undefined) dataset.description = description;

    if (tables && Array.isArray(tables)) {
      dataset.tables = tables; // Fully replace tables to update metadata/descriptions
    }

    await dataset.save();
    res.json(dataset);
  } catch (error) {
    res.status(500).json({ error: 'Server error updating dataset' });
  }
};

exports.deleteDataset = async (req, res) => {
  try {
    const { id: projectId, datasetId } = req.params;

    // In a full implementation, you would also call Google Cloud Storage or Python API 
    // to physically delete the Parquet files associated with these tables.
    // We will just delete the metadata here for simplicity.

    const result = await Dataset.deleteOne({ _id: datasetId, projectId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    res.json({ message: 'Dataset deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting dataset' });
  }
};
