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

const crypto = require('crypto');
const OAuthToken = require('../models/OAuthToken');

const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({ iv: iv.toString('hex'), data: encrypted.toString('hex'), tag: authTag.toString('hex') });
};

// --- Google Sheets ---
exports.listGoogleSheets = async (req, res) => {
  try {
    const token = await OAuthToken.findOne({ userId: req.user.id, provider: 'google' });
    if (!token) return res.status(401).json({ error: 'Google account not connected' });
    
    const response = await axios.post(`${FASTAPI_URL}/connectors/google-sheet/list-sheets`, {
      spreadsheetId: req.body.spreadsheetId,
      token: token.encryptedToken // Send encrypted token to Python
    });
    res.json(response.data);
  } catch (error) {
    const detail = error.response?.data?.detail || error.message;
    res.status(500).json({ error: 'Failed to list sheets', details: detail });
  }
};

exports.connectGoogleSheet = async (req, res) => {
  try {
    const { datasetId, spreadsheetId, selectedSheets, queryMode = 'live' } = req.body;
    const { id: projectId } = req.params;
    
    let dataset = null;
    if (datasetId) {
      dataset = await Dataset.findOne({ _id: datasetId, projectId });
    }
    
    if (!dataset) {
      dataset = await Dataset.create({
        projectId,
        name: 'Google Sheet Dataset',
        description: '',
        tables: []
      });
    }

    const token = await OAuthToken.findOne({ userId: req.user.id, provider: 'google' });
    
    for (const sheetName of selectedSheets) {
      // Proxy to Python to infer schema
      const schemaResponse = await axios.post(`${FASTAPI_URL}/connectors/google-sheet/schema`, {
        spreadsheetId,
        sheetName,
        token: token.encryptedToken
      });
      
      const tableName = sheetName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      
      dataset.tables.push({
        tableName,
        originalFileName: `${spreadsheetId} - ${sheetName}`,
        sourceType: 'google_sheet',
        queryMode,
        sourceConfig: { spreadsheetId, sheetName },
        rowCount: schemaResponse.data.estimatedRows || 0,
        columns: schemaResponse.data.columns || []
      });
    }
    
    await dataset.save();
    res.json(dataset);
  } catch (error) {
    const detail = error.response?.data?.detail || error.message;
    res.status(500).json({ error: 'Failed to connect Google Sheet', details: detail });
  }
};

// --- SQL ---
exports.testSqlConnection = async (req, res) => {
  try {
    const response = await axios.post(`${FASTAPI_URL}/connectors/sql/test`, req.body);
    res.json(response.data);
  } catch (error) {
    const detail = error.response?.data?.detail || error.message;
    res.status(500).json({ error: 'SQL connection failed', details: detail });
  }
};

exports.connectSql = async (req, res) => {
  try {
    const { datasetId, dialect, host, port, database, schema, username, password, selectedTables, queryMode = 'live' } = req.body;
    const { id: projectId } = req.params;
    
    let dataset = datasetId ? await Dataset.findOne({ _id: datasetId, projectId }) : null;
    if (!dataset) {
      dataset = await Dataset.create({ projectId, name: 'SQL Dataset', tables: [] });
    }
    
    const encryptedPassword = encrypt(password);
    
    for (const tableName of selectedTables) {
      const schemaResponse = await axios.post(`${FASTAPI_URL}/connectors/sql/schema`, {
        dialect, host, port, database, schema, tableName, username, password
      });
      
      dataset.tables.push({
        tableName,
        originalFileName: `${database}.${schema}.${tableName}`,
        sourceType: dialect, // 'postgresql' or 'mysql'
        queryMode,
        sourceConfig: { dialect, host, port, database, schema, tableName, username, encryptedPassword },
        rowCount: schemaResponse.data.estimatedRows || 0,
        columns: schemaResponse.data.columns || []
      });
    }
    
    await dataset.save();
    res.json(dataset);
  } catch (error) {
    const detail = error.response?.data?.detail || error.message;
    res.status(500).json({ error: 'Failed to connect SQL', details: detail });
  }
};

// --- MongoDB ---
exports.testMongoConnection = async (req, res) => {
  try {
    const response = await axios.post(`${FASTAPI_URL}/connectors/mongodb/test`, req.body);
    res.json(response.data);
  } catch (error) {
    const detail = error.response?.data?.detail || error.message;
    res.status(500).json({ error: 'MongoDB connection failed', details: detail });
  }
};

exports.connectMongodb = async (req, res) => {
  try {
    const { datasetId, uri, database, selectedCollections, queryMode = 'live' } = req.body;
    const { id: projectId } = req.params;
    
    let dataset = datasetId ? await Dataset.findOne({ _id: datasetId, projectId }) : null;
    if (!dataset) {
      dataset = await Dataset.create({ projectId, name: 'MongoDB Dataset', tables: [] });
    }
    
    const encryptedUri = encrypt(uri);
    
    for (const col of selectedCollections) {
      const { name, pipeline } = col;
      
      const schemaResponse = await axios.post(`${FASTAPI_URL}/connectors/mongodb/schema`, {
        uri, database, collection: name, pipeline
      });
      
      dataset.tables.push({
        tableName: name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
        originalFileName: `${database}.${name}`,
        sourceType: 'mongodb',
        queryMode,
        sourceConfig: { encryptedUri, database, collection: name, pipeline },
        rowCount: schemaResponse.data.estimatedDocs || 0,
        columns: schemaResponse.data.columns || []
      });
    }
    
    await dataset.save();
    res.json(dataset);
  } catch (error) {
    const detail = error.response?.data?.detail || error.message;
    res.status(500).json({ error: 'Failed to connect MongoDB', details: detail });
  }
};

// --- Toggle and Sync ---
exports.patchQueryMode = async (req, res) => {
  try {
    const { id: projectId, datasetId, tableId } = req.params;
    const { queryMode } = req.body;
    
    const dataset = await Dataset.findOne({ _id: datasetId, projectId });
    if (!dataset) return res.status(404).json({ error: 'Dataset not found' });
    
    const table = dataset.tables.id(tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    
    table.queryMode = queryMode;
    
    if (queryMode === 'snapshot') {
       table.syncStatus = 'pending';
       // Here you'd optionally trigger the sync background task immediately
    }
    
    await dataset.save();
    res.json(table);
  } catch (error) {
    res.status(500).json({ error: 'Failed to patch query mode' });
  }
};

exports.syncTable = async (req, res) => {
  try {
    const { id: projectId, datasetId, tableId } = req.params;
    
    const dataset = await Dataset.findOne({ _id: datasetId, projectId });
    if (!dataset) return res.status(404).json({ error: 'Dataset not found' });
    
    const table = dataset.tables.id(tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    
    // Call Python background sync endpoint based on sourceType
    let syncEndpoint = '';
    let payload = { projectId };
    
    if (table.sourceType === 'google_sheet') {
      const token = await OAuthToken.findOne({ userId: req.user.id, provider: 'google' });
      syncEndpoint = '/connectors/google-sheet/ingest';
      payload = { ...payload, spreadsheetId: table.sourceConfig.spreadsheetId, sheetName: table.sourceConfig.sheetName, token: token.encryptedToken };
    } else if (table.sourceType === 'postgresql' || table.sourceType === 'mysql') {
      syncEndpoint = '/connectors/sql/ingest';
      payload = { ...payload, ...table.sourceConfig };
    } else if (table.sourceType === 'mongodb') {
      syncEndpoint = '/connectors/mongodb/ingest';
      payload = { ...payload, ...table.sourceConfig };
    }
    
    const response = await axios.post(`${FASTAPI_URL}${syncEndpoint}`, payload);
    
    table.syncJobId = response.data.jobId;
    table.syncStatus = 'syncing';
    await dataset.save();
    
    res.json({ message: 'Sync started', jobId: response.data.jobId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start sync' });
  }
};

exports.getSyncStatus = async (req, res) => {
  try {
    const { id: projectId, datasetId, tableId } = req.params;
    
    const dataset = await Dataset.findOne({ _id: datasetId, projectId });
    if (!dataset) return res.status(404).json({ error: 'Dataset not found' });
    
    const table = dataset.tables.id(tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    
    if (table.syncJobId && table.syncStatus === 'syncing') {
        try {
            const response = await axios.get(`${FASTAPI_URL}/connectors/sync-status/${table.syncJobId}`);
            const statusData = response.data;
            if (statusData.status.startsWith('completed')) {
                table.syncStatus = 'synced';
                table.lastSyncedAt = new Date();
                table.syncProgress = 100;
                if (statusData.gcsParquetPath) {
                    table.gcsParquetPath = statusData.gcsParquetPath;
                }
                await dataset.save();
            } else if (statusData.status.startsWith('failed')) {
                table.syncStatus = 'error';
                table.syncError = statusData.status;
                await dataset.save();
            } else {
                table.syncProgress = statusData.progress || 0;
            }
        } catch(e) {
            console.error('Error polling sync status', e);
        }
    }
    
    res.json({
        syncStatus: table.syncStatus,
        syncProgress: table.syncProgress,
        lastSyncedAt: table.lastSyncedAt,
        syncError: table.syncError
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sync status' });
  }
};
