const Project = require('../models/Project');

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ user: req.user.id });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createProject = async (req, res) => {
  try {
    const { name, config } = req.body;
    const project = new Project({ name, user: req.user.id, config });
    await project.save();
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findOneAndUpdate(
      { _id: id, user: req.user.id },
      { $set: req.body },
      { new: true }
    );
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findOneAndDelete({ _id: id, user: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // 1. Delete all resources in MongoDB
    const Resource = require('../models/Resource');
    await Resource.deleteMany({ projectId: id });

    // 2. Call FastAPI to delete from ChromaDB
    const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8001/api';
    try {
      const chromaResp = await fetch(`${FASTAPI_URL}/projects/${id}`, { method: 'DELETE' });
      if (!chromaResp.ok) {
        console.warn(`Failed to delete ChromaDB resources for project ${id}`);
      }
    } catch (err) {
      console.warn(`Error connecting to FastAPI while deleting project: ${err.message}`);
    }

    res.json({ message: 'Project and all associated resources deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
