const Lead = require('../models/Lead');
const Project = require('../models/Project');

exports.createLead = async (req, res) => {
  try {
    const { projectId, name, email, phone, metadata } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const lead = new Lead({
      projectId,
      name,
      email,
      phone,
      metadata
    });

    await lead.save();
    res.status(201).json(lead);
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getProjectLeads = async (req, res) => {
  try {
    const { id } = req.params; // project ID
    
    // Verify ownership
    const project = await Project.findOne({ _id: id, user: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found or access denied' });

    const leads = await Lead.find({ projectId: id }).sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
