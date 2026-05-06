import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatWidget from './ChatWidget';

declare global {
  interface Window {
    ChatWidgetConfig: any;
  }
}

const initWidget = async () => {
  const rootElement = document.getElementById('chat-widget-root');
  if (!rootElement) return;

  const projectId = rootElement.getAttribute('data-project-id');
  if (!projectId) {
    console.error('Chat Widget: data-project-id attribute is required.');
    return;
  }

  // Fetch config from backend
  let config = { projectId, primaryColor: '#007bff', requireLeadForm: false, leadFormFields: ['name', 'email'] };
  try {
    const res = await fetch(`http://localhost:4000/api/widget/${projectId}/config`);
    if (res.ok) {
      const data = await res.json();
      config = { ...config, ...data.config };
    }
  } catch (error) {
    console.error('Chat Widget: Failed to load configuration', error);
  }

  const container = document.createElement('div');
  container.id = 'sass-agentic-chat-widget-container';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<ChatWidget config={config} />);
};

// Initialize automatically when the script loads
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initWidget();
} else {
  document.addEventListener('DOMContentLoaded', initWidget);
}
