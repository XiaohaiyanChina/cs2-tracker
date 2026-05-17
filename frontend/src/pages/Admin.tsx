import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePlayers, useTeams, useTournaments, useMatches, useMatchMaps, useMatchStats } from '../hooks/useData';
import { API_BASE } from '../utils/config';
import { calcEloChange, initialElo } from '../utils/elo';
import { generateBracket } from '../utils/bracket';
import { logout } from '../utils/auth';
import BracketView from '../components/BracketView';
import ImageUpload from '../components/ImageUpload';
import { Settings, Trophy, Users, Gamepad2, Swords, Save, Plus, Trash2, CheckCircle, X, ChevronDown, ChevronUp, LogOut, Download, Upload, Square, CheckSquare, Loader2, ExternalLink } from 'lucide-react';
import type { PlayerAttributes, Achievement, PlayerHonor, BracketSlot, Match } from '../types';

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 text-accent animate-spin" />
    </div>
  );
}

async function apiWrite(path: string, options?: RequestInit) {
  const MAX_RETRIES = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, options);
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const b = await res.json();
          if (b && b.error) msg = b.error;
        } catch {
          try { const t = await res.text(); if (t) msg = t.slice(0, 200); } catch {}
        }
        throw new Error(msg);
      }
      return res.json();
    } catch (e: any) {
      lastError = e;
      // Retry on network errors (not HTTP 4xx/5xx)
      if (attempt < MAX_RETRIES - 1 &&
          (e.message.includes('Failed to fetch') || e.message.includes('NetworkError') || e.message.includes('连接失败'))) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

function BatchDeleteBar({ selected, onDelete, onClear }: { selected: string[]; onDelete: () => void; onClear: () => void }) {
  if (selected.length === 0) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-danger/10 border border-danger/30 rounded-lg">
      <span className="text-sm text-danger font-medium">已选 {selected.length} 项</span>
      <div className="flex-1" />
      <button onClick={onClear} className="text-xs text-muted hover:underline">取消</button>
      <button onClick={onDelete} className="flex items-center gap-1 px-3 py-1 bg-danger text-white rounded text-xs font-medium hover:bg-danger/90">
        <Trash2 className="w-3 h-3" /> 批量删除
      </button>
    </div>
  );
}

type TabType = 'tournaments' | 'teams' | 'players' | 'matches' | 'bracket';

const TABS: { key: TabType; icon: typeof Trophy; label: string }[] = [
  { key: 'tournaments', icon: Trophy, label: '赛事管理' },
  { key: 'teams', icon: Users, label: '战队管理' },
  { key: 'players', icon: Gamepad2, label: '选手管理' },
  { key: 'matches', icon: Swords, label: '比赛录入' },
  { key: 'bracket', icon: Trophy, label: '对阵图编辑' },
];

export default function Admin() {
  const [tab, setTab] = useState<TabType>('tournaments');
  const navigate = useNavigate();
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const clearMsg = () => setMsg(null);
  const onMsg = (m: string | { text: string; type: 'success' | 'error' }) => {
    if (typeof m === 'string') setMsg({ text: m, type: 'success' });
    else setMsg(m);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_BASE}/export`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cs2-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onMsg('数据备份已下载');
    } catch (e: any) {
      onMsg({ text: `备份失败: ${e.message}`, type: 'error' });
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const res = await fetch(`${API_BASE}/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (result.ok) {
          onMsg(`数据已恢复：${Object.entries(result.counts).map(([k, v]) => `${k} ${v}条`).join(', ')}`);
          setTimeout(() => window.location.reload(), 1000);
        } else {
          onMsg({ text: `恢复失败: ${result.error || '未知错误'}`, type: 'error' });
        }
      } catch (e: any) {
        onMsg({ text: `恢复失败: ${e.message}`, type: 'error' });
      }
    };
    input.click();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-accent" />
        <h1 className="text-2xl font-bold text-text">管理员面板</h1>
        <div className="flex-1" />
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted hover:text-accent hover:bg-positive/10 rounded-lg transition-colors">
          <Download className="w-4 h-4" /> 备份
        </button>
        <button onClick={handleImport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted hover:text-accent hover:bg-positive/10 rounded-lg transition-colors">
          <Upload className="w-4 h-4" /> 恢复
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface rounded-lg border border-border p-1 mb-6">
        {TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); clearMsg(); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
          msg.type === 'error' ? 'bg-danger/10 border border-danger/30 text-danger' : 'bg-positive/10 border border-positive/30 text-positive'
        }`}>
          {msg.type === 'error' ? <X className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {msg.text}
          <button onClick={clearMsg} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div style={{ display: tab === 'tournaments' ? 'block' : 'none' }}><TournamentEditor onMsg={onMsg} /></div>
      <div style={{ display: tab === 'teams' ? 'block' : 'none' }}><TeamEditor onMsg={onMsg} /></div>
      <div style={{ display: tab === 'players' ? 'block' : 'none' }}><PlayerEditor onMsg={onMsg} /></div>
      <div style={{ display: tab === 'matches' ? 'block' : 'none' }}><MatchEditor onMsg={onMsg} /></div>
      <div style={{ display: tab === 'bracket' ? 'block' : 'none' }}><BracketEditor onMsg={onMsg} /></div>
    </div>
  );
}

/* ============ TOURNAMENT EDITOR ============ */
function TournamentEditor({ onMsg }: { onMsg: (m: string | { text: string; type: 'success' | 'error' }) => void }) {
  const { data: tournaments, loading: loadingTournaments, refresh: refreshTournaments } = useTournaments();
  const { data: teams } = useTeams();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [format, setFormat] = useState<string>('single-elim');
  const [bracketType, setBracketType] = useState<string>('');
  const [status, setStatus] = useState<string>('upcoming');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selTeams, setSelTeams] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const create = async () => {
    if (!name.trim()) return alert('请输入赛事名称');
    try {
      const tid = 'tour_' + Date.now();
      const body: any = {
        id: tid, name: name.trim(), description: desc, format, status,
        startDate: startDate || new Date().toISOString().split('T')[0],
        endDate: endDate || new Date().toISOString().split('T')[0],
        teams: selTeams,
      };
      if (bracketType && selTeams.length >= 4) {
        body.bracketType = bracketType;
        body.bracketSlots = generateBracket(bracketType as any, tid, selTeams);
      } else if (format === 'double-elim' && selTeams.length >= 4) {
        body.bracketType = '4_double';
        body.bracketSlots = generateBracket('4_double', tid, selTeams);
      }
      await apiWrite('/tournaments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onMsg(`赛事 "${name}" 已创建`);
      setName(''); setDesc(''); setSelTeams([]); refreshTournaments();
    } catch (e: any) {
      onMsg({ text: `创建失败: ${e.message}`, type: 'error' });
    }
  };

  const remove = async (id: string) => {
    if (!confirm('确定删除此赛事？')) return;
    try {
      await apiWrite(`/tournaments/${id}`, { method: 'DELETE' });
      refreshTournaments();
      onMsg('赛事已删除');
    } catch (e: any) {
      onMsg({ text: `删除失败: ${e.message}`, type: 'error' });
    }
  };

  const batchRemove = async () => {
    if (!confirm(`确定批量删除 ${selected.length} 个赛事？`)) return;
    try {
      await apiWrite('/batch-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: 'tournaments', ids: selected }),
      });
      refreshTournaments();
      onMsg(`已删除 ${selected.length} 个赛事`);
      setSelected([]);
    } catch (e: any) {
      onMsg({ text: `批量删除失败: ${e.message}`, type: 'error' });
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const selectAll = () => {
    if (!tournaments) return;
    setSelected(selected.length === tournaments.length ? [] : tournaments.map(t => t.id));
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-text">创建新赛事</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder="赛事名称" value={name} onChange={e => setName(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm focus:border-accent outline-none" />
          <select value={format} onChange={e => setFormat(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm">
            <option value="single-elim">单败淘汰</option><option value="double-elim">双败淘汰</option>
            <option value="round-robin">循环赛</option><option value="groups">小组赛+淘汰</option>
          </select>
          <select value={bracketType} onChange={e => setBracketType(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm">
            <option value="">对阵图类型（可选）</option>
            <option value="4_single">4队单淘</option>
            <option value="4_double">4队双淘</option>
            <option value="8_single">8队单淘</option>
            <option value="8_double">8队双淘</option>
          </select>
          <input placeholder="描述" value={desc} onChange={e => setDesc(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm focus:border-accent outline-none sm:col-span-2" />
          <select value={status} onChange={e => setStatus(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm">
            <option value="upcoming">即将开始</option><option value="ongoing">进行中</option><option value="finished">已结束</option>
          </select>
          <div className="flex gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm flex-1" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm flex-1" />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted mb-2">参赛战队</p>
          <div className="flex flex-wrap gap-1.5">
            {teams?.map(t => (
              <button key={t.id} onClick={() => setSelTeams(p => p.includes(t.id) ? p.filter(x => x !== t.id) : [...p, t.id])}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  selTeams.includes(t.id) ? 'bg-accent/10 text-accent border border-accent/30' : 'bg-[#1c2128] text-muted border border-border'
                }`}>{t.name}</button>
            ))}
          </div>
        </div>
        <button onClick={create} className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
          <Plus className="w-4 h-4" /> 创建赛事
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-text">现有赛事 ({loadingTournaments ? '...' : tournaments?.length || 0})</h3>
          <button onClick={selectAll} className="text-xs text-muted hover:text-accent flex items-center gap-1">
            {selected.length > 0 && selected.length === (tournaments?.length ?? 0) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            全选
          </button>
        </div>
        <BatchDeleteBar selected={selected} onDelete={batchRemove} onClear={() => setSelected([])} />
        {loadingTournaments ? <Spinner /> : (
          <table className="data-table">
            <thead><tr><th className="w-8"></th><th>名称</th><th>状态</th><th>日期</th><th>队伍</th><th className="w-16"></th></tr></thead>
            <tbody>
              {tournaments?.map(t => (
                <tr key={t.id}>
                  <td><button onClick={() => toggleSelect(t.id)} className="text-border hover:text-accent">{selected.includes(t.id) ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}</button></td>
                  <td className="font-medium text-text">{t.name}</td>
                  <td><span className={`text-xs px-2 py-0.5 rounded ${t.status === 'ongoing' ? 'bg-positive/15 text-positive' : t.status === 'upcoming' ? 'bg-info/15 text-info' : 'bg-border text-muted'}`}>{t.status === 'ongoing' ? '进行中' : t.status === 'upcoming' ? '即将' : '已结束'}</span></td>
                  <td className="text-muted text-sm">{t.startDate} ~ {t.endDate}</td>
                  <td className="text-muted text-sm">{t.teams?.length || 0} 队</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Link to={`/tournaments/${t.id}`} className="text-accent hover:text-accent/80 text-xs" title="查看详情"><ExternalLink className="w-3.5 h-3.5" /></Link>
                      <button onClick={() => remove(t.id)} className="text-danger hover:text-danger/80 text-xs"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ============ TEAM EDITOR ============ */
function TeamEditor({ onMsg }: { onMsg: (m: string | { text: string; type: 'success' | 'error' }) => void }) {
  const { data: teams, loading: loadingTeams, refresh: refreshTeams } = useTeams();
  const { data: players } = usePlayers();
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [logo, setLogo] = useState('');
  const [selMembers, setSelMembers] = useState<string[]>([]);
  const [coach, setCoach] = useState<string>('');
  const [elo, setElo] = useState(initialElo());
  const [editId, setEditId] = useState<string | null>(null);
  const [achTournament, setAchTournament] = useState('');
  const [achPlacement, setAchPlacement] = useState<string>('冠军');
  const [selected, setSelected] = useState<string[]>([]);

  const reset = () => { setName(''); setTag(''); setLogo(''); setSelMembers([]); setCoach(''); setElo(initialElo()); setEditId(null); };

  const availablePlayers = players?.filter(p => !p.isCoach) || [];
  const coachPlayers = players?.filter(p => p.isCoach) || [];

  const create = async () => {
    if (!name.trim() || !tag.trim()) return alert('请填写战队名和标签');
    try {
      const body = {
        id: editId || ('team_' + Date.now()),
        name: name.trim(), tag: tag.trim().toUpperCase(), logo,
        members: selMembers, coach: coach || null, elo: elo || initialElo(),
        achievements: [] as Achievement[],
        createdAt: new Date().toISOString().split('T')[0],
      };
      const method = editId ? 'PUT' : 'POST';
      const path = editId ? `/teams/${editId}` : '/teams';
      await apiWrite(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      refreshTeams();
      onMsg(editId ? `战队 "${name}" 已更新` : `战队 "${name}" 已创建`);
      reset();
    } catch (e: any) {
      onMsg({ text: `保存失败: ${e.message}`, type: 'error' });
    }
  };

  const startEdit = (t: typeof teams extends (infer U)[] | null ? U : never) => {
    setEditId(t.id); setName(t.name); setTag(t.tag); setLogo(t.logo || '');
    setSelMembers(t.members || []); setCoach(t.coach || ''); setElo(t.elo || initialElo());
  };

  const remove = async (id: string) => {
    if (!confirm('确定删除此战队？选手数据将保留')) return;
    try {
      await apiWrite(`/teams/${id}`, { method: 'DELETE' });
      refreshTeams();
      onMsg('战队已删除（选手数据保留）');
    } catch (e: any) {
      onMsg({ text: `删除失败: ${e.message}`, type: 'error' });
    }
  };

  const batchRemove = async () => {
    if (!confirm(`确定批量删除 ${selected.length} 个战队？选手数据将保留`)) return;
    try {
      await apiWrite('/batch-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: 'teams', ids: selected }),
      });
      refreshTeams();
      onMsg(`已删除 ${selected.length} 个战队`);
      setSelected([]);
    } catch (e: any) {
      onMsg({ text: `批量删除失败: ${e.message}`, type: 'error' });
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const selectAll = () => {
    if (!teams) return;
    setSelected(selected.length === teams.length ? [] : teams.map(t => t.id));
  };

  const toggleMember = (pid: string) => {
    setSelMembers(p => p.includes(pid) ? p.filter(x => x !== pid) : p.length < 5 ? [...p, pid] : p);
  };

  const addAchievement = async (teamId: string) => {
    if (!achTournament.trim()) return;
    try {
      const team = teams?.find(t => t.id === teamId);
      if (!team) return;
      const ach: Achievement = { id: 'ach_' + Date.now(), teamId, tournamentName: achTournament, placement: achPlacement as Achievement['placement'], date: new Date().toISOString().split('T')[0] };
      const updated = { ...team, achievements: [...(team.achievements || []), ach] };
      await apiWrite(`/teams/${teamId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      refreshTeams();
      onMsg('成就已添加');
      setAchTournament('');
    } catch (e: any) {
      onMsg({ text: `添加成就失败: ${e.message}`, type: 'error' });
    }
  };

  const removeAchievement = async (teamId: string, achId: string) => {
    try {
      const team = teams?.find(t => t.id === teamId);
      if (!team) return;
      const updated = { ...team, achievements: team.achievements.filter(a => a.id !== achId) };
      await apiWrite(`/teams/${teamId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      refreshTeams();
      onMsg('成就已移除');
    } catch (e: any) {
      onMsg({ text: `移除成就失败: ${e.message}`, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Create/Edit Form */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-text">{editId ? '编辑战队' : '创建新战队'}</h3>
        <div className="flex items-start gap-6">
          <ImageUpload currentImage={logo} onImageChange={setLogo} size={80} label="战队图标" />
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="战队名称" value={name} onChange={e => setName(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm focus:border-accent outline-none" />
            <input placeholder="标签 (2-4字符)" value={tag} onChange={e => setTag(e.target.value)} maxLength={4} className="border border-border rounded-lg px-3 py-2 text-sm focus:border-accent outline-none uppercase" />
            <input type="number" placeholder="ELO积分" value={elo} onChange={e => setElo(parseInt(e.target.value) || 0)} className="border border-border rounded-lg px-3 py-2 text-sm focus:border-accent outline-none" />
          </div>
        </div>

        {/* Players selection */}
        <div>
          <p className="text-xs text-muted mb-2">队员选择 (最多5人，已选 {selMembers.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {availablePlayers.map(p => (
              <button key={p.id} onClick={() => toggleMember(p.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  selMembers.includes(p.id) ? 'bg-accent/10 text-accent border border-accent/30' : 'bg-[#1c2128] text-muted border border-border'
                }`}>{p.nickname}</button>
            ))}
          </div>
        </div>

        {/* Coach */}
        <div>
          <p className="text-xs text-muted mb-2">教练选择</p>
          <select value={coach} onChange={e => setCoach(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm">
            <option value="">无教练</option>
            {coachPlayers.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
            {availablePlayers.filter(p => !selMembers.includes(p.id)).map(p => <option key={p.id} value={p.id}>{p.nickname} (设为教练)</option>)}
          </select>
        </div>

        <div className="flex gap-2">
          <button onClick={create} className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
            <Save className="w-4 h-4" /> {editId ? '更新' : '创建'}
          </button>
          {editId && <button onClick={reset} className="px-4 py-2 bg-border text-muted rounded-lg text-sm">取消</button>}
        </div>
      </div>

      {/* Team List */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-text">现有战队 ({loadingTeams ? '...' : teams?.length || 0})</h3>
          <button onClick={selectAll} className="text-xs text-muted hover:text-accent flex items-center gap-1">
            {selected.length > 0 && selected.length === (teams?.length ?? 0) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            全选
          </button>
        </div>
        <BatchDeleteBar selected={selected} onDelete={batchRemove} onClear={() => setSelected([])} />
        {loadingTeams ? <Spinner /> : teams?.map(t => (
          <div key={t.id} className="border-b border-border/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => toggleSelect(t.id)} className="text-border hover:text-accent shrink-0">
                  {selected.includes(t.id) ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
                </button>
                {t.logo ? <img src={t.logo} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">{t.tag?.charAt(0)}</div>}
                <div>
                  <span className="font-semibold text-text">{t.name}</span>
                  <span className="text-muted ml-1.5 text-xs">[{t.tag}] ELO: {t.elo}</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => startEdit(t)} className="text-xs text-accent hover:underline">编辑</button>
                <button onClick={() => remove(t.id)} className="text-xs text-danger hover:underline">删除</button>
              </div>
            </div>

            {/* Members */}
            <div className="flex flex-wrap gap-1.5">
              {t.members?.map(pid => {
                const p = players?.find(x => x.id === pid);
                return p ? <span key={pid} className="text-xs px-2 py-0.5 bg-border rounded text-muted">{p.nickname}</span> : null;
              })}
              {t.coach && (() => { const c = players?.find(x => x.id === t.coach); return c ? <span className="text-xs px-2 py-0.5 bg-positive/10 rounded text-positive">{c.nickname} (教练)</span> : null; })()}
            </div>

            {/* Achievements */}
            <div>
              <p className="text-xs text-muted mb-1">成就</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {t.achievements?.map(a => (
                  <span key={a.id} className="text-xs px-2 py-0.5 bg-accent/10 rounded text-accent flex items-center gap-1">
                    {a.placement === '冠军' ? '🥇' : a.placement === '亚军' ? '🥈' : '🏅'} {a.tournamentName} — {a.placement}
                    <button onClick={() => removeAchievement(t.id, a.id)} className="ml-1 text-danger/70 hover:text-danger"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <input placeholder="赛事名" value={achTournament} onChange={e => setAchTournament(e.target.value)} className="border border-border rounded px-2 py-1 text-xs w-32" />
                <select value={achPlacement} onChange={e => setAchPlacement(e.target.value)} className="border border-border rounded px-2 py-1 text-xs">
                  <option>冠军</option><option>亚军</option><option>四强</option><option>八强</option><option>参赛</option>
                </select>
                <button onClick={() => addAchievement(t.id)} className="text-xs text-accent hover:underline">添加成就</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ PLAYER EDITOR ============ */
function PlayerEditor({ onMsg }: { onMsg: (m: string | { text: string; type: 'success' | 'error' }) => void }) {
  const { data: players, loading: loadingPlayers, refresh: refreshPlayers } = usePlayers();
  const { data: teams, refresh: refreshTeams } = useTeams();

  const [editId, setEditId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [realName, setRealName] = useState('');
  const [age, setAge] = useState(0);
  const [gender, setGender] = useState<string>('');
  const [avatar, setAvatar] = useState('');
  const [isCoach, setIsCoach] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [attrs, setAttrs] = useState<PlayerAttributes>({
    rating30: 80, firepower: 75, entrying: 70, trading: 72, opening: 68, clutching: 74, sniping: 65, utility: 70,
  });
  const [honors, setHonors] = useState<PlayerHonor[]>([]);
  const [honorTitle, setHonorTitle] = useState('');
  const [honorTournament, setHonorTournament] = useState('');

  const reset = () => {
    setEditId(null); setNickname(''); setRealName(''); setAge(0); setGender('');
    setAvatar(''); setIsCoach(false);
    setAttrs({ rating30: 80, firepower: 75, entrying: 70, trading: 72, opening: 68, clutching: 74, sniping: 65, utility: 70 });
    setHonors([]); setHonorTitle(''); setHonorTournament('');
  };

  const attrLabels: { key: keyof PlayerAttributes; label: string }[] = [
    { key: 'rating30', label: 'Rating 3.0' },
    { key: 'firepower', label: '火力输出' },
    { key: 'entrying', label: '突破能力' },
    { key: 'trading', label: '补枪效率' },
    { key: 'opening', label: '开局能力' },
    { key: 'clutching', label: '残局能力' },
    { key: 'sniping', label: '狙击能力' },
    { key: 'utility', label: '道具使用' },
  ];

  const create = async () => {
    if (!nickname.trim()) return alert('请输入昵称');
    try {
      const body = {
        id: editId || ('player_' + Date.now()),
        nickname: nickname.trim(), realName: realName.trim(), age, gender, avatar,
        steamId: 'STEAM_1:0:' + Date.now(), isCoach, attributes: attrs,
        honors: honors,
        createdAt: new Date().toISOString().split('T')[0],
      };
      const method = editId ? 'PUT' : 'POST';
      const path = editId ? `/players/${editId}` : '/players';
      await apiWrite(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (editId && !isCoach) {
        const affectedTeams = teams?.filter(t => t.coach === editId) || [];
        for (const t of affectedTeams) {
          await apiWrite(`/teams/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...t, coach: null }) });
        }
      }
      refreshPlayers();
      if (editId) refreshTeams();
      onMsg(editId ? `选手 "${nickname}" 已更新` : `选手 "${nickname}" 已创建`);
      reset();
    } catch (e: any) {
      onMsg({ text: `保存失败: ${e.message}`, type: 'error' });
    }
  };

  const startEdit = (p: any) => {
    setEditId(p.id); setNickname(p.nickname); setRealName(p.realName); setAge(p.age || 0);
    setGender(p.gender || ''); setAvatar(p.avatar || ''); setIsCoach(p.isCoach || false);
    setAttrs(p.attributes || { rating30: 80, firepower: 75, entrying: 70, trading: 72, opening: 68, clutching: 74, sniping: 65, utility: 70 });
    setHonors(p.honors || []);
  };

  const addHonor = () => {
    if (!honorTitle.trim() || !honorTournament.trim()) return;
    setHonors(p => [...p, { id: 'honor_' + Date.now(), playerId: editId || '', title: honorTitle.trim(), tournamentName: honorTournament.trim(), date: new Date().toISOString().split('T')[0] }]);
    setHonorTitle(''); setHonorTournament('');
  };

  const removeHonor = (hid: string) => {
    setHonors(p => p.filter(h => h.id !== hid));
  };

  const remove = async (id: string) => {
    if (!confirm('确定删除此选手？将从所有战队中移除')) return;
    try {
      const affectedTeams = teams?.filter(t => t.members?.includes(id) || t.coach === id) || [];
      for (const t of affectedTeams) {
        const updated = { ...t, members: (t.members || []).filter(x => x !== id), coach: t.coach === id ? null : t.coach };
        await apiWrite(`/teams/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      }
      await apiWrite(`/players/${id}`, { method: 'DELETE' });
      refreshPlayers();
      refreshTeams();
      onMsg('选手已删除，相关战队已更新');
    } catch (e: any) {
      onMsg({ text: `删除失败: ${e.message}`, type: 'error' });
    }
  };

  const batchRemove = async () => {
    if (!confirm(`确定批量删除 ${selected.length} 个选手？将从所有战队中移除`)) return;
    try {
      await apiWrite('/batch-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: 'players', ids: selected }),
      });
      refreshPlayers();
      refreshTeams();
      onMsg(`已删除 ${selected.length} 个选手`);
      setSelected([]);
    } catch (e: any) {
      onMsg({ text: `批量删除失败: ${e.message}`, type: 'error' });
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const selectAll = () => {
    if (!players) return;
    setSelected(selected.length === players.length ? [] : players.map(p => p.id));
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-text">{editId ? '编辑选手' : '添加新选手'}</h3>

        <div className="flex items-start gap-6 flex-wrap">
          <ImageUpload currentImage={avatar} onImageChange={setAvatar} size={88} label="选手照片" />
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="游戏昵称 *" value={nickname} onChange={e => setNickname(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm focus:border-accent outline-none" />
            <input placeholder="真实姓名" value={realName} onChange={e => setRealName(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm focus:border-accent outline-none" />
            <input type="number" placeholder="年龄" value={age || ''} onChange={e => setAge(parseInt(e.target.value) || 0)} className="border border-border rounded-lg px-3 py-2 text-sm focus:border-accent outline-none" />
            <select value={gender} onChange={e => setGender(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm">
              <option value="">性别</option><option value="男">男</option><option value="女">女</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={isCoach} onChange={e => setIsCoach(e.target.checked)} className="rounded" /> 设为教练
            </label>
          </div>
        </div>

        {/* Radar attributes */}
        <div>
          <p className="text-xs text-muted mb-3">能力雷达图属性 (0-100)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {attrLabels.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs text-muted">{label}</label>
                <input type="number" min={0} max={100} value={attrs[key]} onChange={e => setAttrs({ ...attrs, [key]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                  className="border border-border rounded-lg px-3 py-1.5 text-sm focus:border-accent outline-none" />
              </div>
            ))}
          </div>
        </div>

        {/* Player Honors */}
        <div>
          <p className="text-xs text-muted mb-2">个人荣誉</p>
          {honors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {honors.map(h => (
                <span key={h.id} className="text-xs px-2 py-0.5 bg-accent/10 rounded text-accent flex items-center gap-1">
                  🏅 {h.title} — {h.tournamentName}
                  <button onClick={() => removeHonor(h.id)} className="ml-1 text-danger/70 hover:text-danger"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-center">
            <input placeholder="荣誉名称 (如:MVP)" value={honorTitle} onChange={e => setHonorTitle(e.target.value)} className="border border-border rounded px-2 py-1 text-xs w-28" />
            <input placeholder="赛事名称" value={honorTournament} onChange={e => setHonorTournament(e.target.value)} className="border border-border rounded px-2 py-1 text-xs w-32" />
            <button onClick={addHonor} className="text-xs text-accent hover:underline">添加荣誉</button>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={create} className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
            <Save className="w-4 h-4" /> {editId ? '更新' : '添加'}
          </button>
          {editId && <button onClick={reset} className="px-4 py-2 bg-border text-muted rounded-lg text-sm">取消</button>}
        </div>
      </div>

      {/* Player list */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-text">现有选手 ({loadingPlayers ? '...' : players?.length || 0})</h3>
          <button onClick={selectAll} className="text-xs text-muted hover:text-accent flex items-center gap-1">
            {selected.length > 0 && selected.length === (players?.length ?? 0) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            全选
          </button>
        </div>
        <BatchDeleteBar selected={selected} onDelete={batchRemove} onClear={() => setSelected([])} />
        {loadingPlayers ? <Spinner /> : (
        <table className="data-table">
          <thead><tr><th className="w-8"></th><th>照片</th><th>昵称</th><th>姓名</th><th>年龄</th><th>类型</th><th className="w-16"></th></tr></thead>
          <tbody>
            {players?.map(p => (
              <tr key={p.id}>
                <td><button onClick={() => toggleSelect(p.id)} className="text-border hover:text-accent">{selected.includes(p.id) ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}</button></td>
                <td>
                  {p.avatar ? <img src={p.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                    : <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center text-xs text-muted">{p.nickname.charAt(0)}</div>}
                </td>
                <td className="font-medium text-text">{p.nickname}</td>
                <td className="text-muted text-sm">{p.realName}</td>
                <td className="text-muted text-sm">{p.age || '-'}</td>
                <td>{p.isCoach ? <span className="text-xs px-2 py-0.5 bg-positive/15 text-positive rounded">教练</span> : <span className="text-xs px-2 py-0.5 bg-border text-muted rounded">选手</span>}</td>
                <td className="flex gap-1.5">
                  <button onClick={() => startEdit(p)} className="text-accent text-xs hover:underline">编辑</button>
                  <button onClick={() => remove(p.id)} className="text-danger text-xs hover:underline">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

/* ============ MATCH EDITOR ============ */
function MatchEditor({ onMsg }: { onMsg: (m: string | { text: string; type: 'success' | 'error' }) => void }) {
  const { data: tournaments } = useTournaments();
  const { data: teams, refresh: refreshTeams } = useTeams();
  const { data: players } = usePlayers();
  const { data: matches, loading: loadingMatches, refresh: refreshMatches } = useMatches();
  const { data: allMaps, refresh: refreshMaps } = useMatchMaps();
  const { data: allStats, refresh: refreshStats } = useMatchStats();

  const [tournamentId, setTournamentId] = useState('');
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [format, setFormat] = useState<string>('bo3');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [maps, setMaps] = useState<{ mapName: string; scoreA: number; scoreB: number }[]>([{ mapName: 'Mirage', scoreA: 0, scoreB: 0 }]);

  const [newMapName, setNewMapName] = useState('Mirage');

  // Stats editing state
  const [expandMatchId, setExpandMatchId] = useState<string | null>(null);
  const [expandMapId, setExpandMapId] = useState<string | null>(null);
  const [editingStat, setEditingStat] = useState<{ matchMapId: string; playerId: string; kills: string; deaths: string; assists: string; adr: string; rating: string; kpr: string; hs: string; entry: string; clutches: string } | null>(null);
  const [editingMap, setEditingMap] = useState<{ id: string; mapName: string; scoreA: string; scoreB: string } | null>(null);

  const mapOptions = ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Vertigo', 'Dust2', 'Overpass', 'Train'];

  const sortedMatches = matches?.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];
  const [selectedMatches, setSelectedMatches] = useState<string[]>([]);

  const batchRemoveMatches = async () => {
    if (!confirm(`确定批量删除 ${selectedMatches.length} 场比赛？将同时删除相关地图和数据`)) return;
    try {
      await apiWrite('/batch-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: 'matches', ids: selectedMatches }),
      });
      refreshMatches(); refreshMaps(); refreshStats();
      onMsg(`已删除 ${selectedMatches.length} 场比赛`);
      setSelectedMatches([]);
    } catch (e: any) {
      onMsg({ text: `批量删除失败: ${e.message}`, type: 'error' });
    }
  };

  const toggleMatchSelect = (id: string) => {
    setSelectedMatches(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const selectAllMatches = () => {
    if (!sortedMatches.length) return;
    setSelectedMatches(selectedMatches.length === sortedMatches.length ? [] : sortedMatches.map(m => m.id));
  };

  const getTeamPlayers = (matchId: string) => {
    const m = matches?.find(x => x.id === matchId);
    if (!m) return [];
    const all = new Set<string>();
    const teamA = teams?.find(t => t.id === m.teamAId);
    const teamB = teams?.find(t => t.id === m.teamBId);
    teamA?.members?.forEach(x => all.add(x));
    teamB?.members?.forEach(x => all.add(x));
    if (teamA?.coach) all.add(teamA.coach);
    if (teamB?.coach) all.add(teamB.coach);
    return Array.from(all);
  }

  const create = async () => {
    if (!tournamentId || !teamAId || !teamBId) return alert('请填写所有必填项');

    const teamA = teams?.find(t => t.id === teamAId);
    const teamB = teams?.find(t => t.id === teamBId);
    if (!teamA || !teamB) return;

    try {
      const eloA = teamA.elo || initialElo();
      const eloB = teamB.elo || initialElo();
      const actualA = scoreA > scoreB ? 1 : scoreA < scoreB ? 0 : 0.5;
      const { changeA, changeB } = calcEloChange(eloA, eloB, actualA);

      const matchId = 'match_' + Date.now();
      const mapIds = maps.map((_, i) => `mm_${matchId}_${i}`);

      await apiWrite('/matches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: matchId, tournamentId, teamAId, teamBId, scoreA, scoreB,
          date: new Date(date).toISOString(), status: 'finished', format,
          mapIds, eloChangeA: changeA, eloChangeB: changeB,
        }),
      });

      await apiWrite(`/teams/${teamAId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...teamA, elo: eloA + changeA }) });
      await apiWrite(`/teams/${teamBId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...teamB, elo: eloB + changeB }) });

      for (let i = 0; i < maps.length; i++) {
        await apiWrite('/matchMaps', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: mapIds[i], matchId, mapName: maps[i].mapName, scoreA: maps[i].scoreA, scoreB: maps[i].scoreB, pickTeam: null, order: i + 1 }),
        });
      }

      refreshMatches();
      refreshMaps();
      refreshTeams();
      onMsg(`比赛已录入！ELO: ${teamA.name} ${changeA > 0 ? '+' : ''}${changeA}, ${teamB.name} ${changeB > 0 ? '+' : ''}${changeB}`);
      setScoreA(0); setScoreB(0);
    } catch (e: any) {
      onMsg({ text: `录入失败: ${e.message}`, type: 'error' });
    }
  };

  const saveStat = async () => {
    if (!editingStat) return;
    try {
      const statId = 'stat_' + Date.now();
      const body = {
        id: statId,
        matchMapId: editingStat.matchMapId,
        playerId: editingStat.playerId,
        kills: parseInt(editingStat.kills) || 0,
        deaths: parseInt(editingStat.deaths) || 0,
        assists: parseInt(editingStat.assists) || 0,
        adr: parseFloat(editingStat.adr) || 0,
        rating: parseFloat(editingStat.rating) || 0,
        kpr: parseFloat(editingStat.kpr) || 0,
        headshotPercent: parseInt(editingStat.hs) || 0,
        entryKills: parseInt(editingStat.entry) || 0,
        clutches: parseInt(editingStat.clutches) || 0,
      };
      await apiWrite('/matchStats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      refreshStats();
      onMsg('选手数据已添加');
      setEditingStat(null);
    } catch (e: any) {
      onMsg({ text: `添加数据失败: ${e.message}`, type: 'error' });
    }
  };

  const deleteStat = async (statId: string) => {
    if (!confirm('确定删除此数据？')) return;
    try {
      await apiWrite(`/matchStats/${statId}`, { method: 'DELETE' });
      refreshStats();
      onMsg('数据已删除');
    } catch (e: any) {
      onMsg({ text: `删除数据失败: ${e.message}`, type: 'error' });
    }
  };

  const saveMap = async () => {
    if (!editingMap) return;
    try {
      const map = allMaps?.find(mm => mm.id === editingMap.id);
      if (!map) return;
      const updated = { ...map, mapName: editingMap.mapName, scoreA: parseInt(editingMap.scoreA) || 0, scoreB: parseInt(editingMap.scoreB) || 0 };
      await apiWrite(`/matchMaps/${editingMap.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated),
      });
      refreshMaps();
      onMsg(`地图 ${editingMap.mapName} 比分已更新`);
      setEditingMap(null);
    } catch (e: any) {
      onMsg({ text: `更新地图失败: ${e.message}`, type: 'error' });
    }
  };

  const addMapToMatch = async (matchId: string) => {
    const match = matches?.find(m => m.id === matchId);
    if (!match) return;
    try {
      const newMapId = `mm_${matchId}_${Date.now()}`;
      await apiWrite('/matchMaps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newMapId, matchId, mapName: newMapName, scoreA: 0, scoreB: 0, pickTeam: null, order: (match.mapIds?.length || 0) + 1 }),
      });
      const updatedMatch = { ...match, mapIds: [...(match.mapIds || []), newMapId] };
      await apiWrite(`/matches/${matchId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedMatch) });
      refreshMatches();
      refreshMaps();
      onMsg('已添加新地图');
    } catch (e: any) {
      onMsg({ text: `添加地图失败: ${e.message}`, type: 'error' });
    }
  };

  const removeMapFromMatch = async (matchId: string, mapId: string) => {
    if (!confirm('确定删除此地图及所有相关选手数据？')) return;
    try {
      const match = matches?.find(m => m.id === matchId);
      const statsToDelete = (allStats || []).filter(s => s.matchMapId === mapId);
      for (const s of statsToDelete) {
        await apiWrite(`/matchStats/${s.id}`, { method: 'DELETE' });
      }
      await apiWrite(`/matchMaps/${mapId}`, { method: 'DELETE' });
      if (match) {
        const updated = { ...match, mapIds: (match.mapIds || []).filter(id => id !== mapId) };
        await apiWrite(`/matches/${matchId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      }
      refreshMatches();
      refreshMaps();
      refreshStats();
      onMsg('地图已删除');
    } catch (e: any) {
      onMsg({ text: `删除地图失败: ${e.message}`, type: 'error' });
    }
  };

  const startAddStat = (mapId: string) => {
    setEditingStat({ matchMapId: mapId, playerId: '', kills: '', deaths: '', assists: '', adr: '', rating: '', kpr: '', hs: '', entry: '', clutches: '' });
  };

  return (
    <div className="space-y-6">
      {/* Create Match Form */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-text">录入新比赛</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select value={tournamentId} onChange={e => setTournamentId(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm sm:col-span-2">
            <option value="">选择赛事 *</option>
            {tournaments?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={teamAId} onChange={e => setTeamAId(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm">
            <option value="">队伍 A *</option>
            {teams?.map(t => <option key={t.id} value={t.id}>{t.name} [{t.tag}] ELO:{t.elo}</option>)}
          </select>
          <select value={teamBId} onChange={e => setTeamBId(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm">
            <option value="">队伍 B *</option>
            {teams?.map(t => <option key={t.id} value={t.id}>{t.name} [{t.tag}] ELO:{t.elo}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input type="number" min="0" max="3" value={scoreA} onChange={e => setScoreA(parseInt(e.target.value) || 0)} className="border border-border rounded-lg px-3 py-2 text-sm w-16 text-center" />
            <span className="text-muted">:</span>
            <input type="number" min="0" max="3" value={scoreB} onChange={e => setScoreB(parseInt(e.target.value) || 0)} className="border border-border rounded-lg px-3 py-2 text-sm w-16 text-center" />
            <span className="text-xs text-muted">(大比分)</span>
          </div>
          <select value={format} onChange={e => setFormat(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm">
            <option value="bo1">BO1</option><option value="bo3">BO3</option><option value="bo5">BO5</option>
          </select>
          <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm sm:col-span-2" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted">地图比分</span>
            <button onClick={() => setMaps([...maps, { mapName: 'Mirage', scoreA: 0, scoreB: 0 }])} className="text-xs text-accent hover:underline">+ 添加地图</button>
          </div>
          <div className="space-y-2">
            {maps.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={m.mapName} onChange={e => { const nm = [...maps]; nm[i].mapName = e.target.value; setMaps(nm); }} className="border border-border rounded px-2 py-1.5 text-xs">
                  {mapOptions.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <input type="number" min="0" max="16" value={m.scoreA} onChange={e => { const nm = [...maps]; nm[i].scoreA = parseInt(e.target.value) || 0; setMaps(nm); }} className="border border-border rounded px-2 py-1.5 text-xs w-14 text-center" />
                <span className="text-border text-sm">:</span>
                <input type="number" min="0" max="16" value={m.scoreB} onChange={e => { const nm = [...maps]; nm[i].scoreB = parseInt(e.target.value) || 0; setMaps(nm); }} className="border border-border rounded px-2 py-1.5 text-xs w-14 text-center" />
                {maps.length > 1 && <button onClick={() => setMaps(maps.filter((_, idx) => idx !== i))} className="text-danger/70 text-xs"><X className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
          </div>
        </div>

        <button onClick={create} className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
          <Save className="w-4 h-4" /> 录入比赛 (自动计算ELO)
        </button>
      </div>

      {/* Existing Matches + Stats Editor */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-text">比赛数据编辑 ({loadingMatches ? '...' : sortedMatches.length} 场)</h3>
            <p className="text-xs text-muted mt-0.5">展开比赛 → 展开地图 → 添加/编辑选手数据</p>
          </div>
          <button onClick={selectAllMatches} className="text-xs text-muted hover:text-accent flex items-center gap-1 shrink-0">
            {selectedMatches.length === sortedMatches.length && sortedMatches.length > 0 ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            全选
          </button>
        </div>
        <BatchDeleteBar selected={selectedMatches} onDelete={batchRemoveMatches} onClear={() => setSelectedMatches([])} />
        {loadingMatches ? <Spinner /> : (
        <div className="divide-y divide-border">
          {sortedMatches.map(m => {
            const isExpanded = expandMatchId === m.id;
            const teamA = teams?.find(t => t.id === m.teamAId);
            const teamB = teams?.find(t => t.id === m.teamBId);
            const tournament = tournaments?.find(t => t.id === m.tournamentId);
            const matchMaps = (allMaps || []).filter(mm => m.mapIds?.includes(mm.id)).sort((a, b) => a.order - b.order);
            const teamPlayers = getTeamPlayers(m.id);

            return (
              <div key={m.id}>
                {/* Match Row */}
                <div className="flex items-center gap-3 p-3 hover:bg-[#1c2128] transition-colors">
                  <button onClick={(e) => { e.stopPropagation(); toggleMatchSelect(m.id); }} className="text-border hover:text-accent shrink-0">
                    {selectedMatches.includes(m.id) ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div
                    onClick={() => setExpandMatchId(isExpanded ? null : m.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                    <span className="text-xs text-muted w-20 shrink-0">{new Date(m.date).toLocaleDateString('zh-CN')}</span>
                    <span className="text-sm font-medium text-text min-w-0 truncate">{teamA?.name || '?'} <span className="text-xs text-muted">{m.scoreA}:{m.scoreB}</span> {teamB?.name || '?'}</span>
                    <span className="text-xs text-muted shrink-0">[{m.format.toUpperCase()}]</span>
                    <span className="text-xs text-muted shrink-0">{tournament?.name}</span>
                  </div>
                </div>

                {/* Expanded: Maps */}
                {isExpanded && (
                  <div className="bg-[#1c2128] border-t border-border/50 px-4 py-3 space-y-3">
                    {matchMaps.map(mm => {
                      const mapExpanded = expandMapId === mm.id;
                      const mapStats = (allStats || []).filter(s => s.matchMapId === mm.id);
                      return (
                        <div key={mm.id} className="bg-surface border border-border rounded-lg overflow-hidden">
                          {editingMap?.id === mm.id ? (
                            <div className="flex items-center gap-2 px-3 py-2">
                              <select value={editingMap.mapName} onChange={e => setEditingMap({ ...editingMap, mapName: e.target.value })}
                                className="border border-border rounded px-2 py-1 text-xs">
                                {mapOptions.map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                              <input type="number" min="0" max="16" value={editingMap.scoreA} onChange={e => setEditingMap({ ...editingMap, scoreA: e.target.value })}
                                className="border border-border rounded px-2 py-1 text-xs w-14 text-center" />
                              <span className="text-border text-xs">:</span>
                              <input type="number" min="0" max="16" value={editingMap.scoreB} onChange={e => setEditingMap({ ...editingMap, scoreB: e.target.value })}
                                className="border border-border rounded px-2 py-1 text-xs w-14 text-center" />
                              <div className="flex-1" />
                              <button onClick={saveMap} className="flex items-center gap-1 px-2 py-1 bg-accent text-white rounded text-xs"><Save className="w-3 h-3" /> 保存</button>
                              <button onClick={() => setEditingMap(null)} className="px-2 py-1 bg-border text-muted rounded text-xs"><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                          <div
                            onClick={() => setExpandMapId(mapExpanded ? null : mm.id)}
                            className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#1c2128]"
                          >
                            <div className="flex items-center gap-2">
                              {mapExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-muted" />}
                              <span className="text-sm font-medium text-text">{mm.mapName}</span>
                              <span className="text-xs text-muted">({mm.scoreA}:{mm.scoreB})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted">{mapStats.length} 条数据</span>
                              <button onClick={(e) => { e.stopPropagation(); setEditingMap({ id: mm.id, mapName: mm.mapName, scoreA: String(mm.scoreA), scoreB: String(mm.scoreB) }); setExpandMapId(null); }}
                                className="text-xs text-accent hover:underline">编辑比分</button>
                              <button onClick={(e) => { e.stopPropagation(); removeMapFromMatch(m.id, mm.id); }}
                                className="text-xs text-danger hover:underline"><Trash2 className="w-3 h-3 inline mr-0.5" />删除</button>
                            </div>
                          </div>
                          )}

                          {mapExpanded && (
                            <div className="border-t border-border/50">
                              {/* Existing stats */}
                              {mapStats.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-border/50">
                                        <th className="text-left px-2 py-1.5 text-muted font-medium">选手</th>
                                        <th className="text-center px-1.5 py-1.5 text-muted font-medium">K</th>
                                        <th className="text-center px-1.5 py-1.5 text-muted font-medium">D</th>
                                        <th className="text-center px-1.5 py-1.5 text-muted font-medium">A</th>
                                        <th className="text-center px-1.5 py-1.5 text-muted font-medium">ADR</th>
                                        <th className="text-center px-1.5 py-1.5 text-muted font-medium">Rating</th>
                                        <th className="text-center px-1.5 py-1.5 text-muted font-medium">HS%</th>
                                        <th className="text-center px-1.5 py-1.5 text-muted font-medium">首杀</th>
                                        <th className="text-center px-1.5 py-1.5 text-muted font-medium">残局</th>
                                        <th className="w-8"></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {mapStats.sort((a, b) => b.rating - a.rating).map(s => {
                                        const p = players?.find(x => x.id === s.playerId);
                                        return (
                                          <tr key={s.id} className="border-b border-border/50 hover:bg-[#1c2128]">
                                            <td className="px-2 py-1.5 font-medium text-text">{p?.nickname || '?'}</td>
                                            <td className="text-center px-1.5 py-1.5 text-positive font-mono">{s.kills}</td>
                                            <td className="text-center px-1.5 py-1.5 text-danger font-mono">{s.deaths}</td>
                                            <td className="text-center px-1.5 py-1.5 text-muted font-mono">{s.assists}</td>
                                            <td className="text-center px-1.5 py-1.5 text-text font-mono">{s.adr.toFixed(1)}</td>
                                            <td className={`text-center px-1.5 py-1.5 font-mono font-bold ${s.rating >= 1.2 ? 'text-positive' : s.rating < 0.9 ? 'text-danger' : 'text-text'}`}>{s.rating.toFixed(2)}</td>
                                            <td className="text-center px-1.5 py-1.5 text-muted font-mono">{s.headshotPercent}%</td>
                                            <td className="text-center px-1.5 py-1.5 text-text font-mono">{s.entryKills}</td>
                                            <td className="text-center px-1.5 py-1.5 text-text font-mono">{s.clutches}</td>
                                            <td><button onClick={() => deleteStat(s.id)} className="text-danger/70 hover:text-danger"><X className="w-3 h-3" /></button></td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Add/Edit Stat Form */}
                              <div className="border-t border-border/50 p-3">
                                {editingStat && editingStat.matchMapId === mm.id ? (
                                  <div>
                                    <p className="text-xs font-medium text-text mb-2">添加选手数据</p>
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                      <select value={editingStat.playerId} onChange={e => setEditingStat({ ...editingStat, playerId: e.target.value })} className="border border-border rounded px-2 py-1 text-xs col-span-3 sm:col-span-2">
                                        <option value="">选择选手</option>
                                        {teamPlayers.map(pid => {
                                          const p = players?.find(x => x.id === pid);
                                          return p ? <option key={pid} value={pid}>{p.nickname}</option> : null;
                                        })}
                                      </select>
                                      <input placeholder="K" value={editingStat.kills} onChange={e => setEditingStat({ ...editingStat, kills: e.target.value })} className="border border-border rounded px-2 py-1 text-xs w-full" type="number" />
                                      <input placeholder="D" value={editingStat.deaths} onChange={e => setEditingStat({ ...editingStat, deaths: e.target.value })} className="border border-border rounded px-2 py-1 text-xs w-full" type="number" />
                                      <input placeholder="A" value={editingStat.assists} onChange={e => setEditingStat({ ...editingStat, assists: e.target.value })} className="border border-border rounded px-2 py-1 text-xs w-full" type="number" />
                                      <input placeholder="ADR" value={editingStat.adr} onChange={e => setEditingStat({ ...editingStat, adr: e.target.value })} className="border border-border rounded px-2 py-1 text-xs w-full" type="number" step="0.1" />
                                      <input placeholder="Rating" value={editingStat.rating} onChange={e => setEditingStat({ ...editingStat, rating: e.target.value })} className="border border-border rounded px-2 py-1 text-xs w-full" type="number" step="0.01" />
                                      <input placeholder="KPR" value={editingStat.kpr} onChange={e => setEditingStat({ ...editingStat, kpr: e.target.value })} className="border border-border rounded px-2 py-1 text-xs w-full" type="number" step="0.01" />
                                      <input placeholder="HS%" value={editingStat.hs} onChange={e => setEditingStat({ ...editingStat, hs: e.target.value })} className="border border-border rounded px-2 py-1 text-xs w-full" type="number" />
                                      <input placeholder="首杀" value={editingStat.entry} onChange={e => setEditingStat({ ...editingStat, entry: e.target.value })} className="border border-border rounded px-2 py-1 text-xs w-full" type="number" />
                                      <input placeholder="残局" value={editingStat.clutches} onChange={e => setEditingStat({ ...editingStat, clutches: e.target.value })} className="border border-border rounded px-2 py-1 text-xs w-full" type="number" />
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                      <button onClick={saveStat} className="px-3 py-1 bg-accent text-white rounded text-xs">保存</button>
                                      <button onClick={() => setEditingStat(null)} className="px-3 py-1 bg-border text-muted rounded text-xs">取消</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={() => startAddStat(mm.id)} className="flex items-center gap-1 text-xs text-accent hover:underline">
                                    <Plus className="w-3 h-3" /> 添加选手数据
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2 mt-2">
                      <select value={newMapName} onChange={e => setNewMapName(e.target.value)} className="border border-border rounded px-2 py-1 text-xs">
                        {mapOptions.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <button onClick={() => addMapToMatch(m.id)} className="flex items-center gap-1 text-xs text-accent hover:underline">
                        <Plus className="w-3 h-3" /> 添加
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
          )}
      </div>
    </div>
  );
}

/* ============ BRACKET EDITOR ============ */
function BracketEditor({ onMsg }: { onMsg: (m: string | { text: string; type: 'success' | 'error' }) => void }) {
  const { data: tournaments, refresh: refreshTournaments } = useTournaments();
  const { data: teams } = useTeams();
  const { data: allMatches, refresh: refreshMatches } = useMatches();

  const [tournamentId, setTournamentId] = useState('');
  const [bracketType, setBracketType] = useState<string>('');
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ date: '', teamAId: '', teamBId: '', scoreA: '', scoreB: '', format: 'bo3' });

  const tournament = tournaments?.find(t => t.id === tournamentId) || null;
  const slots = tournament?.bracketSlots || [];
  const currentType = tournament?.bracketType || bracketType;

  const slotMatches = useMemo(() => {
    const map = new Map<string, Match | null>();
    slots.forEach((s: BracketSlot) => { map.set(s.id, s.matchId ? (allMatches?.find(m => m.id === s.matchId) || null) : null); });
    return map;
  }, [slots, allMatches]);

  const selectTournament = (tid: string) => {
    setTournamentId(tid);
    const t = tournaments?.find(x => x.id === tid);
    setBracketType(t?.bracketType || '');
  };

  const generateSlots = async () => {
    if (!tournament || !bracketType || tournament.teams.length < 4) {
      return alert('请选择对阵图类型，且赛事需要至少4支队伍');
    }
    try {
      const newSlots = generateBracket(bracketType as any, tournament.id, tournament.teams);
      await apiWrite(`/tournaments/${tournamentId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tournament, bracketType, bracketSlots: newSlots }),
      });
      refreshTournaments();
      onMsg(`对阵图已生成 (${bracketType === '4_single' ? '4队单淘' : bracketType === '4_double' ? '4队双淘' : bracketType === '8_single' ? '8队单淘' : '8队双淘'})`);
    } catch (e: any) {
      onMsg({ text: `生成对阵图失败: ${e.message}`, type: 'error' });
    }
  };

  const startEditSlot = (slot: BracketSlot) => {
    const m = slotMatches.get(slot.id) ?? null;
    const a = m?.teamAId || slot.teamAId || '';
    const b = m?.teamBId || slot.teamBId || '';
    setEditingSlotId(slot.id);
    setEditForm({
      date: m?.date ? new Date(m.date).toISOString().slice(0, 16) : '',
      teamAId: a, teamBId: b,
      scoreA: m ? String(m.scoreA) : '',
      scoreB: m ? String(m.scoreB) : '',
      format: m?.format || 'bo3',
    });
  };

  const saveSlotMatch = async (slot: BracketSlot) => {
    if (!tournament) return;
    try {
      const now = new Date().toISOString();
      let matchId = slot.matchId;

      if (matchId) {
        const match = allMatches?.find(m => m.id === matchId);
        if (match) {
          const newStatus = (editForm.scoreA || editForm.scoreB) ? 'finished' as const : 'upcoming' as const;
          const updated = { ...match, date: editForm.date || match.date, teamAId: editForm.teamAId || match.teamAId, teamBId: editForm.teamBId || match.teamBId, scoreA: editForm.scoreA ? parseInt(editForm.scoreA) : match.scoreA, scoreB: editForm.scoreB ? parseInt(editForm.scoreB) : match.scoreB, format: editForm.format, status: newStatus };
          await apiWrite(`/matches/${matchId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
          if (newStatus === 'finished' && match.status !== 'finished') {
            const teamA = teams?.find(t => t.id === updated.teamAId);
            const teamB = teams?.find(t => t.id === updated.teamBId);
            if (teamA && teamB) {
              const scoreA = updated.scoreA > updated.scoreB ? 1 : 0;
              const { changeA } = calcEloChange(teamA.elo, teamB.elo, scoreA);
              await apiWrite(`/teams/${teamA.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...teamA, elo: teamA.elo + changeA }) });
              await apiWrite(`/teams/${teamB.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...teamB, elo: teamB.elo - changeA }) });
            }
          }
        }
      } else {
        matchId = `match_${Date.now()}`;
        const isFinished = !!(editForm.scoreA && editForm.scoreB);
        await apiWrite('/matches', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: matchId, tournamentId: tournamentId || '', teamAId: editForm.teamAId, teamBId: editForm.teamBId, scoreA: parseInt(editForm.scoreA) || 0, scoreB: parseInt(editForm.scoreB) || 0, date: editForm.date || now, status: isFinished ? 'finished' : 'upcoming', format: editForm.format || 'bo3', mapIds: [], eloChangeA: 0, eloChangeB: 0 }),
        });
        if (isFinished) {
          const teamA = teams?.find(t => t.id === editForm.teamAId);
          const teamB = teams?.find(t => t.id === editForm.teamBId);
          if (teamA && teamB) {
            const score = parseInt(editForm.scoreA) > parseInt(editForm.scoreB) ? 1 : 0;
            const { changeA } = calcEloChange(teamA.elo, teamB.elo, score);
            await apiWrite(`/teams/${teamA.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...teamA, elo: teamA.elo + changeA }) });
            await apiWrite(`/teams/${teamB.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...teamB, elo: teamB.elo - changeA }) });
          }
        }
      }

      const updatedSlots = slots.map((s: BracketSlot) => s.id === slot.id ? { ...s, matchId } : s);
      await apiWrite(`/tournaments/${tournamentId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tournament, bracketSlots: updatedSlots }),
      });
      setEditingSlotId(null);
      refreshMatches();
      refreshTournaments();
      onMsg('比赛已保存');
    } catch (e: any) {
      onMsg({ text: `保存失败: ${e.message}`, type: 'error' });
    }
  };

  const deleteSlotMatch = async (slot: BracketSlot) => {
    if (!tournament || !slot.matchId || !confirm('确定移除此比赛？')) return;
    try {
      await apiWrite(`/matches/${slot.matchId}`, { method: 'DELETE' });
      const updatedSlots = slots.map((s: BracketSlot) => s.id === slot.id ? { ...s, matchId: null } : s);
      await apiWrite(`/tournaments/${tournamentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...tournament, bracketSlots: updatedSlots }) });
      refreshMatches();
      refreshTournaments();
      onMsg('比赛已移除');
    } catch (e: any) {
      onMsg({ text: `移除失败: ${e.message}`, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Select Tournament & Bracket Type */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-text">对阵图编辑</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={tournamentId} onChange={e => selectTournament(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm">
            <option value="">选择赛事</option>
            {tournaments?.map(t => <option key={t.id} value={t.id}>{t.name} ({t.teams?.length || 0}队)</option>)}
          </select>
          <select value={bracketType} onChange={e => setBracketType(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm">
            <option value="">选择对阵图类型</option>
            <option value="4_single">4队单淘 (3场)</option>
            <option value="4_double">4队双淘 (6场)</option>
            <option value="8_single">8队单淘 (7场)</option>
            <option value="8_double">8队双淘 (14场)</option>
          </select>
          <button onClick={generateSlots} disabled={!tournamentId || !bracketType}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors">
            生成/重新生成对阵图
          </button>
        </div>
        {currentType && (
          <p className="text-xs text-muted">
            当前类型：{currentType === '4_single' ? '4队单淘' : currentType === '4_double' ? '4队双淘' : currentType === '8_single' ? '8队单淘' : currentType}
            {slots.length > 0 && ` · ${slots.length} 个槽位`}
          </p>
        )}
      </div>

      {/* Slot Cards with Edit Buttons */}
      {slots.length > 0 && tournament && (
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-text">槽位编辑</h3>
          <p className="text-xs text-muted">点击编辑按钮为每个槽位关联比赛和队伍</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {slots.map(s => {
              const m = slotMatches.get(s.id) ?? null;
              const teamA = teams?.find(t => t.id === (m?.teamAId || s.teamAId));
              const teamB = teams?.find(t => t.id === (m?.teamBId || s.teamBId));
              return (
                <div key={s.id} className="border border-border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      s.round.startsWith('ub') ? 'bg-positive/15 text-positive' :
                      s.round.startsWith('lb') ? 'bg-accent/10 text-accent' :
                      'bg-accent/15 text-accent'
                    }`}>{s.label}</span>
                    <div className="flex gap-1">
                      <button onClick={() => startEditSlot(s)} className="px-2 py-0.5 text-xs bg-positive/10 text-positive border border-positive/30 rounded hover:bg-positive/15">编辑</button>
                      {s.matchId && <button onClick={() => deleteSlotMatch(s)} className="px-2 py-0.5 text-xs bg-danger/10 text-danger border border-danger/30 rounded hover:bg-danger/15">清除</button>}
                    </div>
                  </div>
                  <div className="text-xs text-muted">
                    <div>{teamA?.name || 'TBD'} {m ? `(${m.scoreA}:${m.scoreB})` : ''} vs {teamB?.name || 'TBD'}</div>
                    {m && <div className="text-muted">{new Date(m.date).toLocaleString('zh-CN')} · {m.status === 'finished' ? '已结束' : '预告'}</div>}
                    {!m && <div className="text-border">未关联比赛</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bracket Preview */}
          <div className="border-t border-border pt-4 mt-4">
            <h4 className="font-semibold text-text mb-3">对阵图预览</h4>
            <BracketView slots={slots} allMatches={allMatches || []} teams={teams || []} editable onEditSlot={startEditSlot} onDeleteSlot={deleteSlotMatch} />
          </div>
        </div>
      )}

      {(!tournamentId || slots.length === 0) && (
        <div className="bg-surface border border-border rounded-xl p-8 shadow-sm text-center text-muted text-sm">
          请先选择赛事和对阵图类型，然后点击"生成对阵图"
        </div>
      )}

      {/* Edit Modal */}
      {editingSlotId && (() => {
        const slot = slots.find((s: BracketSlot) => s.id === editingSlotId);
        if (!slot) return null;
        return (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setEditingSlotId(null)}>
            <div className="bg-surface rounded-xl p-6 shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-semibold text-text mb-4">编辑 {slot.label}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted block mb-1">比赛时间</label>
                  <input type="datetime-local" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:border-accent outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted block mb-1">队伍 A</label>
                    <select value={editForm.teamAId} onChange={e => setEditForm({ ...editForm, teamAId: e.target.value })} className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:border-accent outline-none">
                      <option value="">选择队伍</option>
                      {tournament?.teams?.map((tid: string) => { const t = teams?.find(x => x.id === tid); return t ? <option key={tid} value={tid}>{t.name}</option> : null; })}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">队伍 B</label>
                    <select value={editForm.teamBId} onChange={e => setEditForm({ ...editForm, teamBId: e.target.value })} className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:border-accent outline-none">
                      <option value="">选择队伍</option>
                      {tournament?.teams?.map((tid: string) => { const t = teams?.find(x => x.id === tid); return t ? <option key={tid} value={tid}>{t.name}</option> : null; })}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted block mb-1">比分 A</label>
                    <input type="number" min="0" max="3" value={editForm.scoreA} onChange={e => setEditForm({ ...editForm, scoreA: e.target.value })} className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:border-accent outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">比分 B</label>
                    <input type="number" min="0" max="3" value={editForm.scoreB} onChange={e => setEditForm({ ...editForm, scoreB: e.target.value })} className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:border-accent outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">赛制</label>
                  <select value={editForm.format} onChange={e => setEditForm({ ...editForm, format: e.target.value })} className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:border-accent outline-none">
                    <option value="bo1">BO1</option>
                    <option value="bo3">BO3</option>
                    <option value="bo5">BO5</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setEditingSlotId(null)} className="px-4 py-2 bg-border text-muted rounded-lg text-sm"><X className="w-4 h-4 inline mr-1" />取消</button>
                <button onClick={() => saveSlotMatch(slot)} className="px-4 py-2 bg-accent text-white rounded-lg text-sm"><Save className="w-4 h-4 inline mr-1" />保存</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
