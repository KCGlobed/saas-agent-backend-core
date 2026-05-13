import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatWidget from './ChatWidget';

declare global {
  interface Window {
    ChatWidgetConfig: any;
  }
}

// Dynamically determine the backend URL based on where this script is hosted
export let API_BASE_URL = 'http://localhost:4000/api';
if (document.currentScript && (document.currentScript as HTMLScriptElement).src) {
  try {
    const url = new URL((document.currentScript as HTMLScriptElement).src);
    API_BASE_URL = `${url.origin}/api`;
  } catch (e) {
    console.error('Failed to parse script URL', e);
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
    const res = await fetch(`${API_BASE_URL}/widget/${projectId}/config`);
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
