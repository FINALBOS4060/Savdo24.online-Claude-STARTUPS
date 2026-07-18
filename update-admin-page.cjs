const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPage.tsx', 'utf8');

// 1. Add 'support' to activeTab state type
code = code.replace(/useState\<'dashboard' \| 'analytics' \| 'listings' \| 'users' \| 'categories' \| 'disputes' \| 'reports' \| 'sponsors' \| 'audit' \| 'settings'\>/,
  "useState<'dashboard' | 'analytics' | 'listings' | 'users' | 'categories' | 'disputes' | 'reports' | 'sponsors' | 'audit' | 'settings' | 'support'>");

// 2. Add tickets state
const ticketsState = `
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [isLoadingSupport, setIsLoadingSupport] = useState(false);
`;
code = code.replace(/const \[reports, setReports\] = useState\<any\[\]\>\(\[\]\);/, ticketsState + '\n  const [reports, setReports] = useState<any[]>([]);');

// 3. Add fetch logic inside useEffect
const fetchLogic = `
  useEffect(() => {
    if (activeTab === 'support' && supportTickets.length === 0) {
      setIsLoadingSupport(true);
      fetch('/api/admin/support-tickets', {
        headers: { 'Authorization': \`Bearer \${localStorage.getItem('savdo24_token')}\` }
      })
      .then(res => res.json())
      .then(data => setSupportTickets(data))
      .catch(err => console.error(err))
      .finally(() => setIsLoadingSupport(false));
    }
  }, [activeTab]);
`;
code = code.replace(/useEffect\(\(\) => \{\n\s*if \(activeTab === 'sponsors'/, fetchLogic + "\n  useEffect(() => {\n    if (activeTab === 'sponsors'");

// 4. Add Tab Button
const supportTabButton = `
        <button
          onClick={() => setActiveTab('support')}
          className={\`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap px-2 \${
            activeTab === 'support'
              ? 'text-[#f0b90b] border-[#f0b90b]'
              : 'text-[#8892b0] border-transparent hover:text-white'
          }\`}
        >
          <span className="material-symbols-outlined text-sm">support_agent</span>
          Murojaatlar
        </button>
`;
code = code.replace(/<button\n\s*onClick=\{\(\) => setActiveTab\('settings'\)\}/, supportTabButton + "\n        <button\n          onClick={() => setActiveTab('settings')}");

// 5. Add Tab Content
const supportTabContent = `
      {activeTab === 'support' && (
        <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
            <span className="material-symbols-outlined text-[#f0b90b]">support_agent</span>
            Murojaatlar ({supportTickets.length})
          </h2>
          {isLoadingSupport ? (
            <div className="py-12 text-center text-on-primary-container">
              <span className="animate-spin inline-block w-8 h-8 border-4 border-[#f0b90b] border-t-transparent rounded-full mb-2"></span>
              <p className="text-sm font-bold">Yuklanmoqda...</p>
            </div>
          ) : supportTickets.length === 0 ? (
            <div className="py-12 text-center text-on-primary-container space-y-2">
              <span className="material-symbols-outlined text-4xl opacity-40">done_all</span>
              <p className="text-sm font-bold">Yangi murojaatlar yo'q</p>
            </div>
          ) : (
            <div className="space-y-4">
              {supportTickets.map(ticket => (
                <div key={ticket.id} className="bg-[#12161c] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
                  <div className="flex-grow space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{ticket.subject}</span>
                      <span className={\`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider \${
                        ticket.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                        ticket.status === 'reviewing' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                        'bg-green-500/10 text-green-500 border border-green-500/20'
                      }\`}>
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#8892b0]">Mijoz: {ticket.email} | Sana: {new Date(ticket.createdAt).toLocaleString()}</p>
                    <p className="text-sm text-on-primary-container mt-2 bg-white/5 p-3 rounded-lg border border-white/5">{ticket.message}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto mt-4 md:mt-0">
                    {ticket.status === 'pending' && (
                      <button
                        onClick={() => {
                          fetch(\`/api/admin/support-tickets/\${ticket.id}/status\`, {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': \`Bearer \${localStorage.getItem('savdo24_token')}\`
                            },
                            body: JSON.stringify({ status: 'reviewing' })
                          }).then(() => {
                            setSupportTickets(supportTickets.map(t => t.id === ticket.id ? { ...t, status: 'reviewing' } : t));
                            onActionToast('Holat o\\'zgartirildi');
                          });
                        }}
                        className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded-xl font-bold text-xs hover:bg-blue-500/30 transition-all"
                      >
                        Ko'rib chiqilmoqda
                      </button>
                    )}
                    {(ticket.status === 'pending' || ticket.status === 'reviewing') && (
                      <button
                        onClick={() => {
                          fetch(\`/api/admin/support-tickets/\${ticket.id}/status\`, {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': \`Bearer \${localStorage.getItem('savdo24_token')}\`
                            },
                            body: JSON.stringify({ status: 'resolved' })
                          }).then(() => {
                            setSupportTickets(supportTickets.map(t => t.id === ticket.id ? { ...t, status: 'resolved' } : t));
                            onActionToast('Holat o\\'zgartirildi');
                          });
                        }}
                        className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/40 rounded-xl font-bold text-xs hover:bg-green-500/30 transition-all"
                      >
                        Hal qilindi
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
`;
code = code.replace(/\{activeTab === 'settings' && \(/, supportTabContent + "\n      {activeTab === 'settings' && (");

fs.writeFileSync('src/components/AdminPage.tsx', code);
