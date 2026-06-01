import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from './main';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const renderChart = (config: any, key: number, primaryColor: string) => {
  if (!config || !config.data || !config.type) return null;
  const style = { width: '100%', height: 250, margin: '10px 0', background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb' };
  
  if (config.type === 'bar') {
    return (
      <div key={key} style={style}>
        <ResponsiveContainer>
          <BarChart data={config.data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey={config.xKey || 'name'} tick={{fontSize: 11}} />
            <YAxis tick={{fontSize: 11}} />
            <RechartsTooltip contentStyle={{fontSize: 12, borderRadius: 8}} />
            <Legend wrapperStyle={{fontSize: 12}} />
            <Bar dataKey={config.yKey || 'value'} fill={primaryColor} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  } else if (config.type === 'pie') {
    return (
      <div key={key} style={style}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={config.data} dataKey={config.yKey || 'value'} nameKey={config.xKey || 'name'} cx="50%" cy="50%" outerRadius={80} fill={primaryColor} label>
              {config.data.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip contentStyle={{fontSize: 12, borderRadius: 8}} />
            <Legend wrapperStyle={{fontSize: 12}} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  } else if (config.type === 'line') {
    return (
      <div key={key} style={style}>
        <ResponsiveContainer>
          <LineChart data={config.data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey={config.xKey || 'name'} tick={{fontSize: 11}} />
            <YAxis tick={{fontSize: 11}} />
            <RechartsTooltip contentStyle={{fontSize: 12, borderRadius: 8}} />
            <Legend wrapperStyle={{fontSize: 12}} />
            <Line type="monotone" dataKey={config.yKey || 'value'} stroke={primaryColor} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return <pre key={key} style={{fontSize: '11px', background: '#f4f4f4', padding: '8px', borderRadius: '4px', overflowX: 'auto'}}>{JSON.stringify(config, null, 2)}</pre>;
};


const isMarkdownTableSeparator = (line: string) => {
  const t = line.trim();
  if (!t.startsWith('|') || !t.endsWith('|')) return false;
  const inner = t.slice(1, -1);
  if (!/[-:]+/.test(inner)) return false;
  return /^[\s|:-]+$/.test(t);
};

const splitTableRow = (line: string) =>
  line
    .trim()
    .split('|')
    .map((c) => c.trim())
    .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

// Markdown-ish renderer: headings, bullets, numbered lists, hr, pipe tables (with or without separator row)
const renderMarkdown = (text: string, primaryColor: string) => {
  const sanitized = text.replace(/\|\s*\r?\n\s*\r?\n\s*\|/g, '|\n|');
  const lines = sanitized.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let inChartBlock = false;
  let chartJsonStr = '';

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```json chart')) {
      inChartBlock = true;
      i++;
      continue;
    }
    if (inChartBlock) {
      if (line.trim().startsWith('```')) {
         inChartBlock = false;
         try {
           const chartConfig = JSON.parse(chartJsonStr);
           elements.push(renderChart(chartConfig, i, primaryColor));
         } catch(e) {
           elements.push(<pre key={i} style={{fontSize: '11px', background: '#f4f4f4', padding: '8px', borderRadius: '4px', overflowX: 'auto'}}>{chartJsonStr}</pre>);
         }
         chartJsonStr = '';
      } else {
         chartJsonStr += line + '\n';
      }
      i++;
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
      elements.push(<hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '10px 0' }} />);
      i++;
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const next = i + 1 < lines.length ? lines[i + 1] : '';
      const hasSep = next && isMarkdownTableSeparator(next);
      const nextTrim = next.trim();
      const nextIsDataRow =
        nextTrim.startsWith('|') &&
        nextTrim.endsWith('|') &&
        !isMarkdownTableSeparator(next);

      if (hasSep || nextIsDataRow) {
        const headers = splitTableRow(line);
        let j = i + 1;
        if (hasSep) j += 1;
        const rows: string[][] = [];
        while (j < lines.length) {
          const L = lines[j].trim();
          if (!L.startsWith('|') || !L.endsWith('|')) break;
          if (isMarkdownTableSeparator(lines[j])) {
            j++;
            continue;
          }
          rows.push(splitTableRow(lines[j]));
          j++;
        }
        if (headers.length > 0 && rows.length > 0) {
          elements.push(
            <div key={`table-${i}`} style={{ overflowX: 'auto', margin: '10px 0', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left', minWidth: 'max-content' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {headers.map((h, idx) => (
                      <th key={idx} style={{ padding: '8px 10px', fontWeight: '600', color: '#374151', maxWidth: '160px', wordBreak: 'break-word' }}>{parseInline(h, primaryColor)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        borderBottom: rIdx === rows.length - 1 ? 'none' : '1px solid #f3f4f6',
                        background: rIdx % 2 === 1 ? '#fafafa' : 'transparent',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = rIdx % 2 === 1 ? '#fafafa' : 'transparent'; }}
                    >
                      {headers.map((_, cIdx) => (
                        <td key={cIdx} style={{ padding: '8px 10px', color: '#4b5563', maxWidth: '200px', wordBreak: 'break-word', whiteSpace: 'normal', verticalAlign: 'top' }}>
                          {parseInline(r[cIdx] ?? '', primaryColor)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          i = j;
          continue;
        }
      }
    }

    // Heading ## or ###
    if (line.startsWith('### ')) {
      elements.push(<p key={i} style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px', marginTop: '8px', color: 'inherit' }}>{parseInline(line.slice(4), primaryColor)}</p>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<p key={i} style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px', marginTop: '8px', color: 'inherit' }}>{parseInline(line.slice(3), primaryColor)}</p>);
      i++;
      continue;
    }

    // Bullet list starting with * or -
    if (line.match(/^[\*\-] /)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[\*\-] /)) {
        listItems.push(<li key={i} style={{ marginBottom: '2px' }}>{parseInline(lines[i].slice(2), primaryColor)}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} style={{ paddingLeft: '18px', margin: '4px 0 8px 0' }}>{listItems}</ul>);
      continue;
    }

    // Numbered list 1. 2.
    if (line.match(/^\d+\.\s/)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        const m = lines[i].match(/^\d+\.\s(.*)$/);
        listItems.push(<li key={i} style={{ marginBottom: '2px' }}>{parseInline(m ? m[1] : lines[i], primaryColor)}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`} style={{ paddingLeft: '18px', margin: '4px 0 8px 0', listStyleType: 'decimal' }}>{listItems}</ol>);
      continue;
    }

    // Regular paragraph
    elements.push(<p key={i} style={{ margin: '0 0 6px 0', lineHeight: '1.55' }}>{parseInline(line, primaryColor)}</p>);
    i++;
  }

  return elements;
};

const isDownloadableFile = (url: string) => {
  const extensions = ['.xlsx', '.xls', '.csv', '.pdf', '.zip', '.docx', '.pptx'];
  const urlWithoutQuery = url.split('?')[0].toLowerCase();
  return extensions.some(ext => urlWithoutQuery.endsWith(ext));
};

// Inline parser: **bold**, *italic*, `code`, [link](url)
const parseInline = (text: string, primaryColor: string = '#6366f1'): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  // Updated regex to catch markdown links: [label](url)
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const raw = match[0];
    if (raw.startsWith('**')) {
      parts.push(<strong key={match.index}>{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith('*')) {
      parts.push(<em key={match.index}>{raw.slice(1, -1)}</em>);
    } else if (raw.startsWith('`')) {
      parts.push(<code key={match.index} style={{ background: 'rgba(0,0,0,0.07)', padding: '1px 4px', borderRadius: '3px', fontSize: '12px', fontFamily: 'monospace' }}>{raw.slice(1, -1)}</code>);
    } else if (raw.startsWith('[')) {
      const label = match[2];
      const url = match[3];
      if (isDownloadableFile(url)) {
        parts.push(
          <a
            key={match.index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              margin: '4px 0',
              background: primaryColor,
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '12.5px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'transform 0.1s, opacity 0.1s'
            }}
            onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            {label}
          </a>
        );
      } else {
        parts.push(
          <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" style={{ color: primaryColor, fontWeight: '500', textDecoration: 'underline' }}>
            {label}
          </a>
        );
      }
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
};

const ChatWidget = ({ config }: { config: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string; isTyping?: boolean }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lead collection state
  const [leadSubmitted, setLeadSubmitted] = useState(!config.requireLeadForm);
  const [leadForm, setLeadForm] = useState({ name: '', email: '' });
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, leadSubmitted]);

  const [size, setSize] = useState({ width: 380, height: 560 });
  const isResizing = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      e.preventDefault();
      const newWidth = window.innerWidth - 24 - e.clientX;
      const newHeight = window.innerHeight - 96 - e.clientY;
      setSize({
        width: Math.max(380, Math.min(newWidth, window.innerWidth - 48)),
        height: Math.max(560, Math.min(newHeight, window.innerHeight - 120))
      });
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const primaryColor = config.primaryColor || '#6366f1';

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingLead(true);
    try {
      await fetch(`${API_BASE_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: config.projectId, name: leadForm.name, email: leadForm.email })
      });
      setLeadSubmitted(true);
    } catch (error) {
      console.error('Failed to submit lead', error);
      // Allow chat anyway if lead submission fails
      setLeadSubmitted(true);
    }
    setIsSubmittingLead(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    const newMsgs = [...messages, { role: 'user', content: userMsg }];
    setMessages([...newMsgs, { role: 'assistant', content: '', isTyping: true }]);
    setInput('');
    setIsLoading(true);

    let widgetApiToken = undefined;
    if (config.apiTokenLocalStorageKey) {
      const stored = localStorage.getItem(config.apiTokenLocalStorageKey);
      if (stored) widgetApiToken = stored;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/chat/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: config.projectId,
          prompt: userMsg,
          history: messages,
          widgetApiToken: widgetApiToken
        })
      });
      const data = await res.json();
      const reply = data.response || data.content || 'Sorry, I could not get a response.';
      setMessages([...newMsgs, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages([...newMsgs, { role: 'assistant', content: 'Sorry, there was a connection error. Please try again.' }]);
    }
    setIsLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Toggle button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title="Open Chat"
        style={{
          position: 'fixed', bottom: '24px', right: '24px',
          background: primaryColor, color: 'white', border: 'none',
          borderRadius: '50%', width: '60px', height: '60px',
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          transition: 'transform 0.2s, box-shadow 0.2s', zIndex: 9999
        }}
        onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.28)'; }}
        onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.22)'; }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: '96px', right: '24px',
      width: `${size.width}px`, height: `${size.height}px`,
      minWidth: '380px', minHeight: '560px',
      background: 'white', border: 'none',
      borderRadius: '20px', display: 'flex', flexDirection: 'column',
      boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden', zIndex: 9999
    }}>
      {/* Top-Left Resize Handle */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          isResizing.current = true;
          document.body.style.cursor = 'nwse-resize';
          document.body.style.userSelect = 'none';
        }}
        style={{
          position: 'absolute', top: 0, left: 0, width: '24px', height: '24px',
          cursor: 'nwse-resize', zIndex: 10000
        }}
        title="Drag to resize"
      />
      {/* Header */}
      <div style={{
        padding: '18px 20px', background: config.headerColor || primaryColor, color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', background: 'rgba(255,255,255,0.2)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 8v4l3 3"></path>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: '600', fontSize: '15px' }}>{config.chatName || 'AI Assistant'}</div>
            <div style={{ fontSize: '11px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}></span>
              Online
            </div>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8, padding: '4px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Lead form */}
      {!leadSubmitted ? (
        <div style={{ flex: 1, padding: '28px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#fafafa' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ width: '56px', height: '56px', background: primaryColor + '20', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: '700', margin: '0 0 6px', color: '#111827' }}>Welcome!</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Please tell us a bit about yourself to get started.</p>
          </div>
          <form onSubmit={handleLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text" required value={leadForm.name}
              onChange={e => setLeadForm({ ...leadForm, name: e.target.value })}
              placeholder="Your name"
              style={{ padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', width: '100%', transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = primaryColor}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
            <input
              type="email" required value={leadForm.email}
              onChange={e => setLeadForm({ ...leadForm, email: e.target.value })}
              placeholder="your@email.com"
              style={{ padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', width: '100%', transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = primaryColor}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
            <button type="submit" disabled={isSubmittingLead} style={{
              padding: '12px', background: primaryColor, color: 'white', border: 'none',
              borderRadius: '10px', fontWeight: '600', fontSize: '14px',
              cursor: isSubmittingLead ? 'not-allowed' : 'pointer', opacity: isSubmittingLead ? 0.7 : 1, marginTop: '4px'
            }}>
              {isSubmittingLead ? 'Starting...' : 'Start Chatting →'}
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', background: '#f7f8fa', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', marginTop: '60px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>👋</div>
                {config.welcomeMessage || 'How can I help you today?'}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.role === 'assistant' && (
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', background: primaryColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginRight: '8px', flexShrink: 0, alignSelf: 'flex-end'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path>
                    </svg>
                  </div>
                )}
                <div style={{
                  maxWidth: m.role === 'assistant' ? '96%' : '82%',
                  background: m.role === 'user' ? primaryColor : 'white',
                  color: m.role === 'user' ? 'white' : '#1f2937',
                  padding: '10px 14px',
                  borderRadius: '16px',
                  borderBottomRightRadius: m.role === 'user' ? '4px' : '16px',
                  borderBottomLeftRadius: m.role === 'user' ? '16px' : '4px',
                  fontSize: '13.5px',
                  lineHeight: 1.5,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                  border: m.role === 'user' ? 'none' : '1px solid #e5e7eb'
                }}>
                  <div style={{ position: 'relative' }}>
                    {m.isTyping ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
                        {[0, 1, 2].map(d => (
                          <span key={d} style={{
                            width: '7px', height: '7px', borderRadius: '50%', background: '#9ca3af',
                            animation: 'bounce 1.2s infinite', animationDelay: `${d * 0.2}s`,
                            display: 'inline-block'
                          }}></span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ position: 'relative', paddingRight: m.role === 'assistant' ? '24px' : '0' }}>
                        {renderMarkdown(m.content, primaryColor)}
                        {m.role === 'assistant' && (
                          <button
                            title="Copy response"
                            onClick={() => {
                              navigator.clipboard.writeText(m.content);
                              const btn = document.getElementById(`copy-btn-${i}`);
                              if (btn) {
                                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                                setTimeout(() => {
                                  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
                                }, 2000);
                              }
                            }}
                            id={`copy-btn-${i}`}
                            style={{
                              position: 'absolute',
                              top: '-4px',
                              right: '-14px',
                              background: 'transparent',
                              border: 'none',
                              color: '#9ca3af',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.2s',
                            }}
                            onMouseOver={e => e.currentTarget.style.color = '#4b5563'}
                            onMouseOut={e => e.currentTarget.style.color = '#9ca3af'}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', background: 'white', borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', borderRadius: '24px', padding: '4px 4px 4px 14px' }}>
              <input
                type="text" value={input}
                ref={inputRef}
                onChange={e => setInput(e.target.value)}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', color: '#1f2937' }}
                placeholder="Type your message..."
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                style={{
                  background: input.trim() && !isLoading ? primaryColor : '#d1d5db',
                  color: 'white', border: 'none', width: '36px', height: '36px',
                  borderRadius: '50%', cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                  display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
                  transition: 'background 0.2s'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', margin: '8px 0 0' }}>{config.poweredByText || 'Powered by AI'}</p>
          </div>
        </>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ChatWidget;
