const express = require('express');
const authController = require('../controllers/auth');
const projectsController = require('../controllers/projects');
const keysController = require('../controllers/keys');
const chatController = require('../controllers/chat');
const ingestionController = require('../controllers/ingestion');
const leadsController = require('../controllers/leads');
const toolsController = require('../controllers/tools');
const { authMiddleware } = require('../controllers/auth');
const multer = require('multer');

const router = express.Router();
const upload = multer();
// Auth
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// Projects
router.get('/projects', authMiddleware, projectsController.getProjects);
router.post('/projects', authMiddleware, projectsController.createProject);
router.put('/projects/:id', authMiddleware, projectsController.updateProject);
router.delete('/projects/:id', authMiddleware, projectsController.deleteProject);

// API Keys
router.get('/keys', authMiddleware, keysController.getKeys);
router.post('/keys', authMiddleware, keysController.saveKey);

// Data Ingestion Proxy — multi-file, url, raw text
router.post('/projects/:id/ingest/file', authMiddleware, upload.array('file', 20), ingestionController.ingestFiles);
router.post('/projects/:id/ingest/url', authMiddleware, ingestionController.ingestUrl);
router.post('/projects/:id/ingest/text', authMiddleware, ingestionController.ingestText);
router.get('/projects/:id/ingest/status/:jobId', authMiddleware, ingestionController.getStatus);

// Tools
router.post('/projects/:id/tools/parse', authMiddleware, toolsController.parseTextToApi);
router.post('/projects/:id/tools', authMiddleware, toolsController.addToolsToProject);
router.put('/projects/:id/tools/:name', authMiddleware, toolsController.updateToolInProject);
router.delete('/projects/:id/tools/:name', authMiddleware, toolsController.removeToolFromProject);

// Resource Management
router.get('/projects/:id/resources', authMiddleware, ingestionController.listResources);
router.get('/projects/:id/resources/:resourceId/preview', authMiddleware, ingestionController.previewResource);
router.delete('/projects/:id/resources/:resourceId', authMiddleware, ingestionController.deleteResource);

// Knowledge Base (list ingested files for a project)
router.get('/projects/:id/knowledge', authMiddleware, async (req, res) => {
  const Project = require('../models/Project');
  const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8001/api';
  try {
    const project = await Project.findOne({ _id: req.params.id, user: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const response = await fetch(`${FASTAPI_URL}/knowledge/${req.params.id}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Leads
router.get('/projects/:id/leads', authMiddleware, leadsController.getProjectLeads);
router.post('/leads', leadsController.createLead); // Public endpoint for widget

// Widget Config (Public endpoint to fetch theme/settings for widget)
router.get('/widget/:projectId/config', async (req, res) => {
  try {
    const Project = require('../models/Project');
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    // Return only public config, NOT keys or internal settings
    res.json({
      name: project.name,
      config: {
        theme: project.config.theme,
        position: project.config.position,
        primaryColor: project.config.primaryColor,
        headerColor: project.config.headerColor,
        chatName: project.config.chatName,
        welcomeMessage: project.config.welcomeMessage,
        poweredByText: project.config.poweredByText,
        requireLeadForm: project.config.requireLeadForm,
        leadFormFields: project.config.leadFormFields
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Chat (Public endpoint called by Widget)
// In a real system, we might want a different middleware here to verify the request comes from the trusted Python backend or via a Widget token
router.post('/chat/generate', chatController.generateChat);

module.exports = router;
