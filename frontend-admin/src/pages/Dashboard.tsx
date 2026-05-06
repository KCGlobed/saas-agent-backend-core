import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../utils/api';

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', provider: 'openai', model: 'gpt-4o' });
  const navigate = useNavigate();

  const loadProjects = async () => {
    try {
      const data = await fetchApi('/projects');
      setProjects(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadProjects(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await fetchApi('/projects', {
        method: 'POST',
        body: JSON.stringify({ name: newProject.name, config: { provider: newProject.provider, model: newProject.model } })
      });
      setShowModal(false);
      setNewProject({ name: '', provider: 'openai', model: 'gpt-4o' });
      loadProjects();
    } catch (err: any) { alert(`Error: ${err.message}`); }
    setIsCreating(false);
  };

  const providerColor: Record<string, string> = {
    openai: '#10a37f', claude: '#cc785c', llama: '#7c3aed'
  };
  const providerBg: Record<string, string> = {
    openai: '#e6f4f0', claude: '#faf0ec', llama: '#f3f0fd'
  };

  return (
    <div style={{ padding: '32px 40px', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', margin: 0 }}>Projects</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Manage your AI-powered knowledge bases</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#6366f1', color: 'white', border: 'none',
            borderRadius: 8, padding: '10px 18px', fontWeight: 600, fontSize: 13,
            cursor: 'pointer', boxShadow: '0 1px 3px rgba(99,102,241,0.3)',
            transition: 'background 0.15s'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#4f46e5'}
          onMouseOut={e => e.currentTarget.style.background = '#6366f1'}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> New Project
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Projects', value: projects.length, color: '#6366f1' },
          { label: 'OpenAI Projects', value: projects.filter(p => p.config.provider === 'openai').length, color: '#10a37f' },
          { label: 'Active Today', value: projects.length, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div style={{
          background: 'white', border: '2px dashed #e2e8f0', borderRadius: 16,
          textAlign: 'center', padding: '80px 40px', color: '#94a3b8'
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#475569', marginBottom: 6 }}>No projects yet</div>
          <div style={{ fontSize: 13 }}>Create your first AI knowledge base to get started</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {projects.map(proj => (
            <div
              key={proj._id}
              style={{
                background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
                padding: '20px', cursor: 'pointer', transition: 'box-shadow 0.2s, border-color 0.2s',
                position: 'relative', overflow: 'hidden'
              }}
              onClick={() => navigate(`/project/${proj._id}`)}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(99,102,241,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = '#a5b4fc'; }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; }}
            >
              {/* Top accent bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, marginTop: 6 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
                }}>
                  🧠
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  background: providerBg[proj.config.provider] || '#f1f5f9',
                  color: providerColor[proj.config.provider] || '#64748b',
                  textTransform: 'capitalize'
                }}>
                  {proj.config.provider}
                </span>
              </div>

              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>{proj.name}</h3>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>Model: {proj.config.model}</p>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#cbd5e1', fontFamily: 'monospace' }}>{proj._id.slice(-8)}</span>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: '#6366f1',
                  display: 'flex', alignItems: 'center', gap: 4
                }}>
                  Open →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            
            <div style={{ padding: '24px 24px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>New Project</h2>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Set up a new AI knowledge base</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20 }}>✕</button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Project Name *</label>
                  <input type="text" required value={newProject.name}
                    onChange={e => setNewProject({...newProject, name: e.target.value})}
                    placeholder="e.g. Customer Support Bot"
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>AI Provider *</label>
                  <select value={newProject.provider} onChange={e => setNewProject({...newProject, provider: e.target.value})}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background: 'white' }}>
                    <option value="openai">OpenAI</option>
                    <option value="claude">Anthropic Claude</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Model *</label>
                  <input type="text" required value={newProject.model}
                    onChange={e => setNewProject({...newProject, model: e.target.value})}
                    placeholder="gpt-4o"
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '10px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', color: '#64748b', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={isCreating}
                  style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: '#6366f1', color: 'white', fontWeight: 600, fontSize: 13, cursor: isCreating ? 'not-allowed' : 'pointer', opacity: isCreating ? 0.7 : 1 }}>
                  {isCreating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
