import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchApi, API_URL as BASE_URL } from '../utils/api';

// ─── Types ───────────────────────────────────────────────
interface Resource {
  _id: string;
  type: 'file' | 'url' | 'text';
  originalName: string;
  mimeType?: string;
  sizeBytes?: number;
  gcsPath?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  chunkCount: number;
  preview?: string;
  jobId?: string;
  errorMessage?: string;
  createdAt: string;
}

// ─── Sub-components ───────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    processing: 'bg-amber-100 text-amber-700',
    pending:    'bg-blue-100 text-blue-700',
    failed:     'bg-red-100 text-red-700',
  };
  const dots: Record<string, string> = {
    completed: 'bg-green-500', 
    processing: 'bg-amber-500 animate-pulse',
    pending: 'bg-blue-500 animate-pulse', 
    failed: 'bg-red-500'
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] || 'bg-gray-400'}`}></span>
      {status === 'processing' ? 'chunking...' : status}
    </span>
  );
};

const TypeBadge = ({ type }: { type: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    file: { label: '📄 File', cls: 'bg-purple-50 text-purple-700' },
    url:  { label: '🌐 URL',  cls: 'bg-sky-50 text-sky-700' },
    text: { label: '📝 Text', cls: 'bg-amber-50 text-amber-700' },
  };
  const item = map[type] || { label: type, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${item.cls}`}>{item.label}</span>;
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ─── Preview Modal ────────────────────────────────────────
const PreviewModal = ({ resourceId, projectId, name, onClose }: { resourceId: string; projectId: string; name: string; onClose: () => void }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi(`/projects/${projectId}/resources/${resourceId}/preview`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [resourceId, projectId]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 truncate pr-4">{name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading preview...</p>
          ) : !data ? (
            <p className="text-sm text-red-500">Failed to load preview.</p>
          ) : (
            <>
              {data.preview ? (
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-2">Text Preview (first 500 chars)</p>
                  <pre className="bg-gray-50 text-gray-800 text-sm p-4 rounded-lg whitespace-pre-wrap leading-relaxed border border-gray-200">{data.preview}</pre>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No text preview available for this resource type.</p>
              )}
              {data.gcsUrl && (
                <div className="mt-4">
                  <a href={data.gcsUrl} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline font-medium">
                    ↓ Download Original File
                  </a>
                  <p className="text-xs text-gray-400 mt-1">Link valid for 15 minutes.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────
const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'file' | 'url' | 'text' | 'widget'>('file');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(true);

  // Forms
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [textLabel, setTextLabel] = useState('');

  // Widget settings
  const [widgetConfig, setWidgetConfig] = useState({ 
    systemPrompt: '', 
    primaryColor: '#007bff', 
    headerColor: '#007bff',
    chatName: 'AI Assistant',
    welcomeMessage: 'Hello! How can I assist you today?',
    poweredByText: 'Powered by AI',
    requireLeadForm: false 
  });

  // Resources
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Load project data ──
  const loadResources = useCallback(async () => {
    setIsLoadingResources(true);
    try {
      const data = await fetchApi(`/projects/${id}/resources`);
      setResources(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load resources', e);
    }
    setIsLoadingResources(false);
  }, [id]);

  useEffect(() => {
    const load = async () => {
      try {
        const projects = await fetchApi('/projects');
        const proj = projects.find((p: any) => p._id === id);
        if (proj) {
          setProject(proj);
          setWidgetConfig({
            systemPrompt: proj.config.systemPrompt || '',
            primaryColor: proj.config.primaryColor || '#007bff',
            headerColor: proj.config.headerColor || '#007bff',
            chatName: proj.config.chatName || 'AI Assistant',
            welcomeMessage: proj.config.welcomeMessage || 'Hello! How can I assist you today?',
            poweredByText: proj.config.poweredByText || 'Powered by AI',
            requireLeadForm: proj.config.requireLeadForm || false
          });
        }
      } catch (e) { console.error(e); }
    };
    load();
    loadResources();
  }, [id, loadResources]);

  // Auto-refresh processing resources
  useEffect(() => {
    const hasProcessing = resources.some(r => r.status === 'processing' || r.status === 'pending');
    if (!hasProcessing) return;
    const timer = setTimeout(loadResources, 4000);
    return () => clearTimeout(timer);
  }, [resources, loadResources]);

  const showMessage = (msg: string, success = true) => {
    setStatusMessage(msg); setIsSuccess(success);
    if (success) {
      setTimeout(() => setStatusMessage(''), 8000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  // ── File Upload (multi) ──
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;

    setIsIngesting(true);
    showMessage(`Uploading and chunking ${selectedFiles.length} file(s)...`);
    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('file', f));

    try {
      const res = await fetch(`${BASE_URL}/projects/${id}/ingest/file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      showMessage(`✓ ${selectedFiles.length} file(s) uploaded successfully. Chunking and indexing in progress...`);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(loadResources, 1000);
    } catch (err: any) { showMessage(err.message, false); }
    setIsIngesting(false);
  };

  // ── URL Ingest ──
  const handleUrlIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    showMessage('Submitting URL...');
    try {
      await fetchApi(`/projects/${id}/ingest/url`, { method: 'POST', body: JSON.stringify({ url: urlInput.trim() }) });
      showMessage('✓ URL submitted for ingestion.');
      setUrlInput('');
      setTimeout(loadResources, 1000);
    } catch (err: any) { showMessage(err.message, false); }
  };

  // ── Text Ingest ──
  const handleTextIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    showMessage('Submitting text...');
    try {
      await fetchApi(`/projects/${id}/ingest/text`, {
        method: 'POST',
        body: JSON.stringify({ text: textInput.trim(), label: textLabel.trim() || undefined })
      });
      showMessage('✓ Text submitted for ingestion.');
      setTextInput(''); setTextLabel('');
      setTimeout(loadResources, 1000);
    } catch (err: any) { showMessage(err.message, false); }
  };

  // ── Widget Settings Save ──
  const saveWidgetSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi(`/projects/${id}`, { method: 'PUT', body: JSON.stringify({ config: { ...project.config, ...widgetConfig } }) });
      showMessage('✓ Widget settings saved.');
      setProject({ ...project, config: { ...project.config, ...widgetConfig } });
    } catch (err: any) { showMessage(err.message, false); }
  };

  // ── Delete Resource ──
  const handleDelete = async (resource: Resource) => {
    if (!confirm(`Delete "${resource.originalName}"? This will remove it from the knowledge base permanently.`)) return;
    setDeletingId(resource._id);
    try {
      await fetchApi(`/projects/${id}/resources/${resource._id}`, { method: 'DELETE' });
      setResources(prev => prev.filter(r => r._id !== resource._id));
      showMessage('✓ Resource deleted.');
    } catch (err: any) { showMessage(err.message, false); }
    setDeletingId(null);
  };

  const tabClass = (tab: string) => `py-2 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`;

  if (!project) return <div className="p-8 text-center text-gray-400">Loading project...</div>;

  return (
    <div className="p-8 w-full">
      {previewResource && (
        <PreviewModal
          resourceId={previewResource._id}
          projectId={id!}
          name={previewResource.originalName}
          onClose={() => setPreviewResource(null)}
        />
      )}

      <Link to="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 inline-block">← Back to Dashboard</Link>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
        <p className="text-sm text-gray-500 mt-1">Project ID: {project._id} · Provider: {project.config.provider}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT: Ingestion Tabs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">Add Knowledge</h2>

            <div className="flex border-b border-gray-200 mb-6">
              <button onClick={() => setActiveTab('file')} className={tabClass('file')}>📄 Files</button>
              <button onClick={() => setActiveTab('url')} className={tabClass('url')}>🌐 Website URL</button>
              <button onClick={() => setActiveTab('text')} className={tabClass('text')}>📝 Raw Text</button>
              <button onClick={() => setActiveTab('widget')} className={tabClass('widget')}>⚙️ Widget</button>
            </div>

            {statusMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${isSuccess ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {statusMessage}
              </div>
            )}

            {activeTab === 'file' && (
              <form onSubmit={handleFileUpload}>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors bg-white">
                  <div className="text-4xl mb-2">☁️</div>
                  <p className="text-sm font-medium text-gray-700">
                    {selectedFiles.length > 0 
                      ? `${selectedFiles.length} files selected` 
                      : 'Click to select files or drag & drop'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOCX, XLSX, CSV, TXT · Multiple files supported</p>
                  
                  {selectedFiles.length > 0 && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {selectedFiles.slice(0, 5).map((f, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100 truncate max-w-[150px]">
                          {f.name}
                        </span>
                      ))}
                      {selectedFiles.length > 5 && (
                        <span className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded border border-gray-100">
                          +{selectedFiles.length - 5} more
                        </span>
                      )}
                    </div>
                  )}

                  <input 
                    type="file" 
                    multiple 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".pdf,.docx,.xlsx,.csv,.txt,.json" 
                    onChange={handleFileChange}
                  />
                </label>
                <button 
                  type="submit" 
                  disabled={isIngesting || selectedFiles.length === 0}
                  className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isIngesting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Chunking & Uploading...
                    </>
                  ) : (
                    'Upload & Ingest Files'
                  )}
                </button>
              </form>
            )}

            {activeTab === 'url' && (
              <form onSubmit={handleUrlIngest} className="space-y-3">
                <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)} required
                  placeholder="https://docs.example.com/page" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                <p className="text-xs text-gray-400">We'll scrape the page content and index it in your knowledge base.</p>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors">
                  Scrape & Ingest URL
                </button>
              </form>
            )}

            {activeTab === 'text' && (
              <form onSubmit={handleTextIngest} className="space-y-3">
                <input type="text" value={textLabel} onChange={e => setTextLabel(e.target.value)}
                  placeholder="Label (optional, e.g. 'FAQ', 'About Us')" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                <textarea value={textInput} onChange={e => setTextInput(e.target.value)} required rows={7}
                  placeholder="Paste raw text, FAQs, product descriptions, or any content here..." 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none" />
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors">
                  Ingest Raw Text
                </button>
              </form>
            )}

            {activeTab === 'widget' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <form onSubmit={saveWidgetSettings} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Chat Name</label>
                      <input type="text" value={widgetConfig.chatName} onChange={e => setWidgetConfig({...widgetConfig, chatName: e.target.value})}
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Powered By Text</label>
                      <input type="text" value={widgetConfig.poweredByText} onChange={e => setWidgetConfig({...widgetConfig, poweredByText: e.target.value})}
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message</label>
                    <input type="text" value={widgetConfig.welcomeMessage} onChange={e => setWidgetConfig({...widgetConfig, welcomeMessage: e.target.value})}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Theme Color</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={widgetConfig.primaryColor} onChange={e => setWidgetConfig({...widgetConfig, primaryColor: e.target.value})}
                          className="h-10 w-12 p-1 border border-gray-300 rounded-lg cursor-pointer" />
                        <span className="font-mono text-xs text-gray-500 uppercase">{widgetConfig.primaryColor}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Header Color</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={widgetConfig.headerColor} onChange={e => setWidgetConfig({...widgetConfig, headerColor: e.target.value})}
                          className="h-10 w-12 p-1 border border-gray-300 rounded-lg cursor-pointer" />
                        <span className="font-mono text-xs text-gray-500 uppercase">{widgetConfig.headerColor}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
                    <textarea value={widgetConfig.systemPrompt} onChange={e => setWidgetConfig({...widgetConfig, systemPrompt: e.target.value})}
                      rows={3} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="You are a helpful assistant..." />
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <input type="checkbox" id="requireLead" checked={widgetConfig.requireLeadForm} onChange={e => setWidgetConfig({...widgetConfig, requireLeadForm: e.target.checked})}
                      className="h-4 w-4 text-blue-600 rounded" />
                    <div>
                      <label htmlFor="requireLead" className="text-sm font-medium text-gray-900 cursor-pointer">Require Name & Email before chat</label>
                      <p className="text-xs text-gray-400 mt-0.5">Enables lead generation — users must introduce themselves first.</p>
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors">
                    Save Widget Settings
                  </button>
                </form>

                {/* Live Preview */}
                <div className="hidden xl:flex flex-col items-center">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Live Preview</p>
                  <div className="w-[320px] h-[480px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col scale-90 origin-top">
                    <div style={{ background: widgetConfig.headerColor }} className="p-4 flex justify-between items-center text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">🤖</div>
                        <div>
                          <p className="text-xs font-bold">{widgetConfig.chatName}</p>
                          <p className="text-[10px] opacity-80 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span> Online
                          </p>
                        </div>
                      </div>
                      <div className="opacity-70">✕</div>
                    </div>
                    <div className="flex-1 bg-gray-50 p-4 space-y-3">
                      <div className="flex justify-start">
                        <div className="max-w-[80%] bg-white p-3 rounded-2xl rounded-bl-none shadow-sm text-xs border border-gray-100">
                          {widgetConfig.welcomeMessage}
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div style={{ background: widgetConfig.primaryColor }} className="max-w-[80%] p-3 rounded-2xl rounded-br-none shadow-sm text-xs text-white">
                          Hi there!
                        </div>
                      </div>
                    </div>
                    <div className="p-3 border-t border-gray-100 bg-white">
                      <div className="bg-gray-100 rounded-full px-4 py-2 text-xs text-gray-400 flex justify-between items-center">
                        Type a message...
                        <div style={{ background: widgetConfig.primaryColor }} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]">➤</div>
                      </div>
                      <p className="text-[10px] text-gray-300 text-center mt-2">{widgetConfig.poweredByText}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Resources Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Knowledge Base</h2>
                <p className="text-xs text-gray-400 mt-0.5">{resources.length} resource{resources.length !== 1 ? 's' : ''} indexed</p>
              </div>
              <button onClick={loadResources} className="text-xs text-blue-600 hover:underline font-medium">↻ Refresh</button>
            </div>

            {isLoadingResources && resources.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">Loading resources...</div>
            ) : resources.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📂</div>
                <p className="text-gray-500 font-medium">No resources yet</p>
                <p className="text-xs text-gray-400 mt-1">Upload files, paste a URL, or add raw text above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Resource</th>
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Size / Chunks</th>
                      <th className="px-4 py-3 text-left font-medium">Added</th>
                      <th className="px-4 py-3 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {resources.map(res => (
                      <tr key={res._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 max-w-xs">
                          <p className="font-medium text-gray-800 truncate" title={res.originalName}>{res.originalName}</p>
                          {res.errorMessage && <p className="text-xs text-red-500 truncate mt-0.5">{res.errorMessage}</p>}
                        </td>
                        <td className="px-4 py-3"><TypeBadge type={res.type} /></td>
                        <td className="px-4 py-3"><StatusBadge status={res.status} /></td>
                        <td className="px-4 py-3 text-gray-500">
                          {res.chunkCount > 0 ? `${res.chunkCount} chunks` : formatBytes(res.sizeBytes || 0)}
                        </td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(res.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setPreviewResource(res)} 
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                              Preview
                            </button>
                            <button onClick={() => handleDelete(res)} disabled={deletingId === res._id}
                              className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-40">
                              {deletingId === res._id ? '...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <div className="space-y-6">
          {/* Embed Widget */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-3">Embed Widget</h2>
            <p className="text-xs text-gray-500 mb-3">Copy this snippet into your website's HTML.</p>
            <div className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs font-mono leading-relaxed overflow-x-auto">
              {`<div id="chat-widget-root"\n  data-project-id="${id}">\n</div>\n<script src="http://localhost:4000/widget/chat-widget.umd.js">\n</script>`}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(`<div id="chat-widget-root" data-project-id="${id}"></div>\n<script src="http://localhost:4000/widget/chat-widget.umd.js"></script>`); showMessage('✓ Copied to clipboard!'); }}
              className="mt-3 text-xs text-blue-600 font-medium hover:underline">Copy Code</button>
          </div>

          {/* Quick stats */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4">Stats</h2>
            <div className="space-y-3">
              {(['completed','processing','failed'] as const).map(s => (
                <div key={s} className="flex justify-between items-center">
                  <StatusBadge status={s} />
                  <span className="font-semibold text-gray-700">{resources.filter(r => r.status === s).length}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
                <span className="text-gray-500">Total chunks</span>
                <span className="font-semibold text-gray-700">{resources.reduce((acc, r) => acc + (r.chunkCount || 0), 0)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProjectDetails;
