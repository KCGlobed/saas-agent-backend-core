const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  config: {
    provider: { type: String, enum: ['openai', 'claude', 'llama'], default: 'openai' },
    model: { type: String, default: 'gpt-4o' },
    systemPrompt: { type: String, default: 'You are a helpful AI assistant. ONLY answer based on the provided context. If the answer is not in the context, say "I cannot answer this based on the provided documents." Do not make up information.' },
    // Specific settings for the frontend widget
    theme: { type: String, default: 'light' },
    position: { type: String, default: 'bottom-right' },
    primaryColor: { type: String, default: '#007bff' },
    headerColor: { type: String, default: '#007bff' },
    chatName: { type: String, default: 'AI Assistant' },
    welcomeMessage: { type: String, default: 'Hello! How can I assist you today?' },
    poweredByText: { type: String, default: 'Powered by AI' },
    requireLeadForm: { type: Boolean, default: false },
    leadFormFields: { type: [String], default: ['name', 'email'] }
  }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
