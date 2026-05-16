import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayers, useTeams, useTournaments, useMatches, useMatchMaps, useMatchStats } from '../hooks/useData';
import { API_BASE } from '../utils/config';
import { calcEloChange, initialElo } from '../utils/elo';
import { logout } from '../utils/auth';
import ImageUpload from '../components/ImageUpload';
import { Settings, Trophy, Users, Gamepad2, Swords, Save, Plus, Trash2, CheckCircle, X, ChevronDown, ChevronUp, LogOut, Download, Upload, Square, CheckSquare, Loader2 } from 'lucide-react';
import type { PlayerAttributes, Achievement } from '../types';

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );
}

function BatchDeleteBar({ selected, onDelete, onClear }: { selected: string[]; onDelete: () => void; onClear: () => void }) {
  if (selected.length === 0) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
      <span className="text-sm text-red-700 font-medium">已选 {selected.length} 项</span>
      <div className="flex-1" />
      <button onClick={onClear} className="text-xs text-gray-500 hover:underline">取消</button>
      <button onClick={onDelete} className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600">
        <Trash2 className="w-3 h-3" /> 批量删除
      </button>
    </div>
  );
}

type TabType = 'tournaments' | 'teams' | 'players' | 'matches';

const TABS: { key: TabType; icon: typeof Trophy; label: string }[] = [
  { key: 'tournaments', icon: Trophy, label: '赛事管理' },
  { key: 'teams', icon: Users, label: '战队管理' },
  { key: 'players', icon: Gamepad2, label: '选手管理' },
  { key: 'matches', icon: Swords, label: '比赛录入' },
];

export default function Admin() {
  const [tab, setTab] = useState<TabType>('tournaments');
  const navigate = useNavigate();
  const [msg, setMsg] = useState('');

  const clearMsg = () => setMsg('');

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
      setMsg('数据备份已下载');
    } catch {
      setMsg('备份失败');
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
          setMsg(`数据已恢复：${Object.entries(result.counts).map(([k, v]) => `${k} ${v}条`).join(', ')}`);
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch {
        setMsg('恢复失败，请检查文件格式');
      }
    };
    input.click();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-gray-900">管理员面板</h1>
        <div className="flex-1" />
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-primary hover:bg-green-50 rounded-lg transition-colors">
          <Download className="w-4 h-4" /> 备份
        </button>
        <button onClick={handleImport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-primary hover:bg-green-50 rounded-lg transition-colors">
          <Upload className="w-4 h-4" /> 恢复
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 mb-6">
        {TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); clearMsg(); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {msg}
          <button onClick={clearMsg} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div style={{ display: tab === 'tournaments' ? 'block' : 'none' }}><TournamentEditor onMsg={setMsg} /></div>
      <div style={{ display: tab === 'teams' ? 'block' : 'none' }}><TeamEditor onMsg={setMsg} /></div>
      <div style={{ display: tab === 'players' ? 'block' : 'none' }}><PlayerEditor onMsg={setMsg} /></div>
      <div style={{ display: tab === 'matches' ? 'block' : 'none' }}><MatchEditor onMsg={setMsg} /></div>
    </div>
  );
}

/* ============ TOURNAMENT EDITOR ============ */
function TournamentEditor({ onMsg }: { onMsg: (s: string) => void }) {
  const { data: tournaments, loading: loadingTournaments, refresh: refreshTournaments } = useTournaments();
  const { data: teams } = useTeams();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [format, setFormat] = useState<string>('single-elim');
  const [status, setStatus] = useState<string>('upcoming');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selTeams, setSelTeams] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const create = async () => {
    if (!name.trim()) return alert('请输入赛事名称');
    const res = await fetch(`${API_BASE}/tournaments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'tour_' + Date.now(), name: name.trim(), description: desc, format, status,
        startDate: startDate || new Date().toISOString().split('T')[0],
        endDate: endDate || new Date().toISOString().split('T')[0],
        teams: selTeams,
      }),
    });
    if (res.ok) { onMsg(`赛事 "${name}" 已创建`); setName(''); setDesc(''); setSelTeams([]); refreshTournaments(); }
  };

  const remove = async (id: string) => {
    if (!confirm('确定删除此赛事？')) return;
    await fetch(`${API_BASE}/tournaments/${id}`, { method: 'DELETE' });
    refreshTournaments();
    onMsg('赛事已删除');
  };

  const batchRemove = async () => {
    if (!confirm(`确定批量删除 ${selected.length} 个赛事？`)) return;
    const res = await fetch(`${API_BASE}/batch-delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: 'tournaments', ids: selected }),
    });
    if (res.ok) {
      refreshTournaments();
      onMsg(`已删除 ${selected.length} 个赛事`);
      setSelected([]);
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
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-gray-900">创建新赛事</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder="赛事名称" value={name} onChange={e => setName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
          <select value={format} onChange={e => setFormat(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="single-elim">单败淘汰</option><option value="double-elim">双败淘汰</option>
            <option value="round-robin">循环赛</option><option value="groups">小组赛+淘汰</option>
          </select>
          <input placeholder="描述" value={desc} onChange={e => setDesc(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none sm:col-span-2" />
          <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="upcoming">即将开始</option><option value="ongoing">进行中</option><option value="finished">已结束</option>
          </select>
          <div className="flex gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1" />
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-2">参赛战队</p>
          <div className="flex flex-wrap gap-1.5">
            {teams?.map(t => (
              <button key={t.id} onClick={() => setSelTeams(p => p.includes(t.id) ? p.filter(x => x !== t.id) : [...p, t.id])}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  selTeams.includes(t.id) ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-gray-50 text-gray-500 border border-gray-200'
                }`}>{t.name}</button>
            ))}
          </div>
        </div>
        <button onClick={create} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors">
          <Plus className="w-4 h-4" /> 创建赛事
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">现有赛事 ({loadingTournaments ? '...' : tournaments?.length || 0})</h3>
          <button onClick={selectAll} className="text-xs text-gray-400 hover:text-primary flex items-center gap-1">
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
                  <td><button onClick={() => toggleSelect(t.id)} className="text-gray-300 hover:text-primary">{selected.includes(t.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}</button></td>
                  <td className="font-medium text-gray-900">{t.name}</td>
                  <td><span className={`text-xs px-2 py-0.5 rounded ${t.status === 'ongoing' ? 'bg-green-100 text-green-700' : t.status === 'upcoming' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{t.status === 'ongoing' ? '进行中' : t.status === 'upcoming' ? '即将' : '已结束'}</span></td>
                  <td className="text-gray-500 text-sm">{t.startDate} ~ {t.endDate}</td>
                  <td className="text-gray-500 text-sm">{t.teams?.length || 0} 队</td>
                  <td><button onClick={() => remove(t.id)} className="text-red-500 hover:text-red-700 text-xs"><Trash2 className="w-3.5 h-3.5" /></button></td>
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
function TeamEditor({ onMsg }: { onMsg: (s: string) => void }) {
  const { data: teams, loading: loadingTeams, refresh: refreshTeams } = useTeams();
  const { data: players } = usePlayers();
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [logo, setLogo] = useState('');
  const [selMembers, setSelMembers] = useState<string[]>([]);
  const [coach, setCoach] = useState<string>('');
  const [editId, setEditId] = useState<string | null>(null);
  const [achTournament, setAchTournament] = useState('');
  const [achPlacement, setAchPlacement] = useState<string>('冠军');
  const [selected, setSelected] = useState<string[]>([]);

  const reset = () => { setName(''); setTag(''); setLogo(''); setSelMembers([]); setCoach(''); setEditId(null); };

  const availablePlayers = players?.filter(p => !p.isCoach) || [];
  const coachPlayers = players?.filter(p => p.isCoach) || [];

  const create = async () => {
    if (!name.trim() || !tag.trim()) return alert('请填写战队名和标签');
    const body = {
      id: editId || ('team_' + Date.now()),
      name: name.trim(), tag: tag.trim().toUpperCase(), logo,
      members: selMembers, coach: coach || null, elo: initialElo(),
      achievements: [] as Achievement[],
      createdAt: new Date().toISOString().split('T')[0],
    };
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `${API_BASE}/teams/${editId}` : `${API_BASE}/teams`;
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    refreshTeams();
    onMsg(editId ? `战队 "${name}" 已更新` : `战队 "${name}" 已创建`);
    reset();
  };

  const startEdit = (t: typeof teams extends (infer U)[] | null ? U : never) => {
    setEditId(t.id); setName(t.name); setTag(t.tag); setLogo(t.logo || '');
    setSelMembers(t.members || []); setCoach(t.coach || '');
  };

  const remove = async (id: string) => {
    if (!confirm('确定删除此战队？选手数据将保留')) return;
    await fetch(`${API_BASE}/teams/${id}`, { method: 'DELETE' });
    refreshTeams();
    onMsg('战队已删除（选手数据保留）');
  };

  const batchRemove = async () => {
    if (!confirm(`确定批量删除 ${selected.length} 个战队？选手数据将保留`)) return;
    const res = await fetch(`${API_BASE}/batch-delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: 'teams', ids: selected }),
    });
    if (res.ok) {
      refreshTeams();
      onMsg(`已删除 ${selected.length} 个战队`);
      setSelected([]);
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
    const team = teams?.find(t => t.id === teamId);
    if (!team) return;
    const ach: Achievement = { id: 'ach_' + Date.now(), teamId, tournamentName: achTournament, placement: achPlacement as Achievement['placement'], date: new Date().toISOString().split('T')[0] };
    const updated = { ...team, achievements: [...(team.achievements || []), ach] };
    await fetch(`${API_BASE}/teams/${teamId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
    refreshTeams();
    onMsg('成就已添加');
    setAchTournament('');
  };

  const removeAchievement = async (teamId: string, achId: string) => {
    const team = teams?.find(t => t.id === teamId);
    if (!team) return;
    const updated = { ...team, achievements: team.achievements.filter(a => a.id !== achId) };
    await fetch(`${API_BASE}/teams/${teamId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
    refreshTeams();
    onMsg('成就已移除');
  };

  return (
    <div className="space-y-6">
      {/* Create/Edit Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-gray-900">{editId ? '编辑战队' : '创建新战队'}</h3>
        <div className="flex items-start gap-6">
          <ImageUpload currentImage={logo} onImageChange={setLogo} size={80} label="战队图标" />
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="战队名称" value={name} onChange={e => setName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
            <input placeholder="标签 (2-4字符)" value={tag} onChange={e => setTag(e.target.value)} maxLength={4} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none uppercase" />
          </div>
        </div>

        {/* Players selection */}
        <div>
          <p className="text-xs text-gray-400 mb-2">队员选择 (最多5人，已选 {selMembers.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {availablePlayers.map(p => (
              <button key={p.id} onClick={() => toggleMember(p.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  selMembers.includes(p.id) ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-gray-50 text-gray-500 border border-gray-200'
                }`}>{p.nickname}</button>
            ))}
          </div>
        </div>

        {/* Coach */}
        <div>
          <p className="text-xs text-gray-400 mb-2">教练选择</p>
          <select value={coach} onChange={e => setCoach(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">无教练</option>
            {coachPlayers.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
            {availablePlayers.filter(p => !selMembers.includes(p.id)).map(p => <option key={p.id} value={p.id}>{p.nickname} (设为教练)</option>)}
          </select>
        </div>

        <div className="flex gap-2">
          <button onClick={create} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors">
            <Save className="w-4 h-4" /> {editId ? '更新' : '创建'}
          </button>
          {editId && <button onClick={reset} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">取消</button>}
        </div>
      </div>

      {/* Team List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">现有战队 ({loadingTeams ? '...' : teams?.length || 0})</h3>
          <button onClick={selectAll} className="text-xs text-gray-400 hover:text-primary flex items-center gap-1">
            {selected.length > 0 && selected.length === (teams?.length ?? 0) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            全选
          </button>
        </div>
        <BatchDeleteBar selected={selected} onDelete={batchRemove} onClear={() => setSelected([])} />
        {loadingTeams ? <Spinner /> : teams?.map(t => (
          <div key={t.id} className="border-b border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => toggleSelect(t.id)} className="text-gray-300 hover:text-primary shrink-0">
                  {selected.includes(t.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                </button>
                {t.logo ? <img src={t.logo} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{t.tag?.charAt(0)}</div>}
                <div>
                  <span className="font-semibold text-gray-900">{t.name}</span>
                  <span className="text-gray-400 ml-1.5 text-xs">[{t.tag}] ELO: {t.elo}</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => startEdit(t)} className="text-xs text-primary hover:underline">编辑</button>
                <button onClick={() => remove(t.id)} className="text-xs text-red-500 hover:underline">删除</button>
              </div>
            </div>

            {/* Members */}
            <div className="flex flex-wrap gap-1.5">
              {t.members?.map(pid => {
                const p = players?.find(x => x.id === pid);
                return p ? <span key={pid} className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">{p.nickname}</span> : null;
              })}
              {t.coach && (() => { const c = players?.find(x => x.id === t.coach); return c ? <span className="text-xs px-2 py-0.5 bg-green-50 rounded text-green-600">{c.nickname} (教练)</span> : null; })()}
            </div>

            {/* Achievements */}
            <div>
              <p className="text-xs text-gray-400 mb-1">成就</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {t.achievements?.map(a => (
                  <span key={a.id} className="text-xs px-2 py-0.5 bg-yellow-50 rounded text-yellow-700 flex items-center gap-1">
                    {a.placement === '冠军' ? '🥇' : a.placement === '亚军' ? '🥈' : '🏅'} {a.tournamentName} — {a.placement}
                    <button onClick={() => removeAchievement(t.id, a.id)} className="ml-1 text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <input placeholder="赛事名" value={achTournament} onChange={e => setAchTournament(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs w-32" />
                <select value={achPlacement} onChange={e => setAchPlacement(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs">
                  <option>冠军</option><option>亚军</option><option>四强</option><option>八强</option><option>参赛</option>
                </select>
                <button onClick={() => addAchievement(t.id)} className="text-xs text-primary hover:underline">添加成就</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ PLAYER EDITOR ============ */
function PlayerEditor({ onMsg }: { onMsg: (s: string) => void }) {
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

  const reset = () => {
    setEditId(null); setNickname(''); setRealName(''); setAge(0); setGender('');
    setAvatar(''); setIsCoach(false);
    setAttrs({ rating30: 80, firepower: 75, entrying: 70, trading: 72, opening: 68, clutching: 74, sniping: 65, utility: 70 });
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
    const body = {
      id: editId || ('player_' + Date.now()),
      nickname: nickname.trim(), realName: realName.trim(), age, gender, avatar,
      steamId: 'STEAM_1:0:' + Date.now(), isCoach, attributes: attrs,
      createdAt: new Date().toISOString().split('T')[0],
    };
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `${API_BASE}/players/${editId}` : `${API_BASE}/players`;
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      // If player is removed from coach role, update teams
      if (editId && !isCoach) {
        const affectedTeams = teams?.filter(t => t.coach === editId) || [];
        for (const t of affectedTeams) {
          await fetch(`${API_BASE}/teams/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...t, coach: null }) });
        }
      }
      refreshPlayers();
      if (editId) refreshTeams();
      onMsg(editId ? `选手 "${nickname}" 已更新` : `选手 "${nickname}" 已创建`);
      reset();
    }
  };

  const startEdit = (p: any) => {
    setEditId(p.id); setNickname(p.nickname); setRealName(p.realName); setAge(p.age || 0);
    setGender(p.gender || ''); setAvatar(p.avatar || ''); setIsCoach(p.isCoach || false);
    setAttrs(p.attributes || { rating30: 80, firepower: 75, entrying: 70, trading: 72, opening: 68, clutching: 74, sniping: 65, utility: 70 });
  };

  const remove = async (id: string) => {
    if (!confirm('确定删除此选手？将从所有战队中移除')) return;
    // Remove from all teams first
    const affectedTeams = teams?.filter(t => t.members?.includes(id) || t.coach === id) || [];
    for (const t of affectedTeams) {
      const updated = { ...t, members: (t.members || []).filter(x => x !== id), coach: t.coach === id ? null : t.coach };
      await fetch(`${API_BASE}/teams/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
    }
    await fetch(`${API_BASE}/players/${id}`, { method: 'DELETE' });
    refreshPlayers();
    refreshTeams();
    onMsg('选手已删除，相关战队已更新');
  };

  const batchRemove = async () => {
    if (!confirm(`确定批量删除 ${selected.length} 个选手？将从所有战队中移除`)) return;
    const res = await fetch(`${API_BASE}/batch-delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: 'players', ids: selected }),
    });
    if (res.ok) {
      refreshPlayers();
      refreshTeams();
      onMsg(`已删除 ${selected.length} 个选手`);
      setSelected([]);
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
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-gray-900">{editId ? '编辑选手' : '添加新选手'}</h3>

        <div className="flex items-start gap-6 flex-wrap">
          <ImageUpload currentImage={avatar} onImageChange={setAvatar} size={88} label="选手照片" />
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="游戏昵称 *" value={nickname} onChange={e => setNickname(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
            <input placeholder="真实姓名" value={realName} onChange={e => setRealName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
            <input type="number" placeholder="年龄" value={age || ''} onChange={e => setAge(parseInt(e.target.value) || 0)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
            <select value={gender} onChange={e => setGender(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">性别</option><option value="男">男</option><option value="女">女</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={isCoach} onChange={e => setIsCoach(e.target.checked)} className="rounded" /> 设为教练
            </label>
          </div>
        </div>

        {/* Radar attributes */}
        <div>
          <p className="text-xs text-gray-400 mb-3">能力雷达图属性 (0-100)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {attrLabels.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">{label}</label>
                <input type="number" min={0} max={100} value={attrs[key]} onChange={e => setAttrs({ ...attrs, [key]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:border-primary outline-none" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={create} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors">
            <Save className="w-4 h-4" /> {editId ? '更新' : '添加'}
          </button>
          {editId && <button onClick={reset} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">取消</button>}
        </div>
      </div>

      {/* Player list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">现有选手 ({loadingPlayers ? '...' : players?.length || 0})</h3>
          <button onClick={selectAll} className="text-xs text-gray-400 hover:text-primary flex items-center gap-1">
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
                <td><button onClick={() => toggleSelect(p.id)} className="text-gray-300 hover:text-primary">{selected.includes(p.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}</button></td>
                <td>
                  {p.avatar ? <img src={p.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                    : <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">{p.nickname.charAt(0)}</div>}
                </td>
                <td className="font-medium text-gray-900">{p.nickname}</td>
                <td className="text-gray-500 text-sm">{p.realName}</td>
                <td className="text-gray-500 text-sm">{p.age || '-'}</td>
                <td>{p.isCoach ? <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">教练</span> : <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">选手</span>}</td>
                <td className="flex gap-1.5">
                  <button onClick={() => startEdit(p)} className="text-primary text-xs hover:underline">编辑</button>
                  <button onClick={() => remove(p.id)} className="text-red-500 text-xs hover:underline">删除</button>
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
function MatchEditor({ onMsg }: { onMsg: (s: string) => void }) {
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

  // Stats editing state
  const [expandMatchId, setExpandMatchId] = useState<string | null>(null);
  const [expandMapId, setExpandMapId] = useState<string | null>(null);
  const [editingStat, setEditingStat] = useState<{ matchMapId: string; playerId: string; kills: string; deaths: string; assists: string; adr: string; rating: string; kpr: string; hs: string; entry: string; clutches: string } | null>(null);

  const mapOptions = ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Vertigo', 'Dust2', 'Overpass', 'Train'];

  const sortedMatches = matches?.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];
  const [selectedMatches, setSelectedMatches] = useState<string[]>([]);

  const batchRemoveMatches = async () => {
    if (!confirm(`确定批量删除 ${selectedMatches.length} 场比赛？将同时删除相关地图和数据`)) return;
    const res = await fetch(`${API_BASE}/batch-delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: 'matches', ids: selectedMatches }),
    });
    if (res.ok) {
      refreshMatches(); refreshMaps(); refreshStats();
      onMsg(`已删除 ${selectedMatches.length} 场比赛`);
      setSelectedMatches([]);
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

    const eloA = teamA.elo || initialElo();
    const eloB = teamB.elo || initialElo();
    const actualA = scoreA > scoreB ? 1 : scoreA < scoreB ? 0 : 0.5;
    const { changeA, changeB } = calcEloChange(eloA, eloB, actualA);

    const matchId = 'match_' + Date.now();
    const mapIds = maps.map((_, i) => `mm_${matchId}_${i}`);

    await fetch(`${API_BASE}/matches`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: matchId, tournamentId, teamAId, teamBId, scoreA, scoreB,
        date: new Date(date).toISOString(), status: 'finished', format,
        mapIds, eloChangeA: changeA, eloChangeB: changeB,
      }),
    });

    await fetch(`${API_BASE}/teams/${teamAId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...teamA, elo: eloA + changeA }) });
    await fetch(`${API_BASE}/teams/${teamBId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...teamB, elo: eloB + changeB }) });

    for (let i = 0; i < maps.length; i++) {
      await fetch(`${API_BASE}/matchMaps`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mapIds[i], matchId, mapName: maps[i].mapName, scoreA: maps[i].scoreA, scoreB: maps[i].scoreB, pickTeam: null, order: i + 1 }),
      });
    }

    refreshMatches();
    refreshMaps();
    refreshTeams();
    onMsg(`比赛已录入！ELO: ${teamA.name} ${changeA > 0 ? '+' : ''}${changeA}, ${teamB.name} ${changeB > 0 ? '+' : ''}${changeB}`);
    setScoreA(0); setScoreB(0);
  };

  const saveStat = async () => {
    if (!editingStat) return;
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
    await fetch(`${API_BASE}/matchStats`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    refreshStats();
    onMsg('选手数据已添加');
    setEditingStat(null);
  };

  const deleteStat = async (statId: string) => {
    if (!confirm('确定删除此数据？')) return;
    await fetch(`${API_BASE}/matchStats/${statId}`, { method: 'DELETE' });
    refreshStats();
    onMsg('数据已删除');
  };

  const startAddStat = (mapId: string) => {
    setEditingStat({ matchMapId: mapId, playerId: '', kills: '', deaths: '', assists: '', adr: '', rating: '', kpr: '', hs: '', entry: '', clutches: '' });
  };

  return (
    <div className="space-y-6">
      {/* Create Match Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-gray-900">录入新比赛</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select value={tournamentId} onChange={e => setTournamentId(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-2">
            <option value="">选择赛事 *</option>
            {tournaments?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={teamAId} onChange={e => setTeamAId(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">队伍 A *</option>
            {teams?.map(t => <option key={t.id} value={t.id}>{t.name} [{t.tag}] ELO:{t.elo}</option>)}
          </select>
          <select value={teamBId} onChange={e => setTeamBId(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">队伍 B *</option>
            {teams?.map(t => <option key={t.id} value={t.id}>{t.name} [{t.tag}] ELO:{t.elo}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input type="number" min="0" max="3" value={scoreA} onChange={e => setScoreA(parseInt(e.target.value) || 0)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-16 text-center" />
            <span className="text-gray-400">:</span>
            <input type="number" min="0" max="3" value={scoreB} onChange={e => setScoreB(parseInt(e.target.value) || 0)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-16 text-center" />
            <span className="text-xs text-gray-400">(大比分)</span>
          </div>
          <select value={format} onChange={e => setFormat(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="bo1">BO1</option><option value="bo3">BO3</option><option value="bo5">BO5</option>
          </select>
          <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-2" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">地图比分</span>
            <button onClick={() => setMaps([...maps, { mapName: 'Mirage', scoreA: 0, scoreB: 0 }])} className="text-xs text-primary hover:underline">+ 添加地图</button>
          </div>
          <div className="space-y-2">
            {maps.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={m.mapName} onChange={e => { const nm = [...maps]; nm[i].mapName = e.target.value; setMaps(nm); }} className="border border-gray-200 rounded px-2 py-1.5 text-xs">
                  {mapOptions.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <input type="number" min="0" max="16" value={m.scoreA} onChange={e => { const nm = [...maps]; nm[i].scoreA = parseInt(e.target.value) || 0; setMaps(nm); }} className="border border-gray-200 rounded px-2 py-1.5 text-xs w-14 text-center" />
                <span className="text-gray-300 text-sm">:</span>
                <input type="number" min="0" max="16" value={m.scoreB} onChange={e => { const nm = [...maps]; nm[i].scoreB = parseInt(e.target.value) || 0; setMaps(nm); }} className="border border-gray-200 rounded px-2 py-1.5 text-xs w-14 text-center" />
                {maps.length > 1 && <button onClick={() => setMaps(maps.filter((_, idx) => idx !== i))} className="text-red-400 text-xs"><X className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
          </div>
        </div>

        <button onClick={create} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors">
          <Save className="w-4 h-4" /> 录入比赛 (自动计算ELO)
        </button>
      </div>

      {/* Existing Matches + Stats Editor */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">比赛数据编辑 ({loadingMatches ? '...' : sortedMatches.length} 场)</h3>
            <p className="text-xs text-gray-400 mt-0.5">展开比赛 → 展开地图 → 添加/编辑选手数据</p>
          </div>
          <button onClick={selectAllMatches} className="text-xs text-gray-400 hover:text-primary flex items-center gap-1 shrink-0">
            {selectedMatches.length === sortedMatches.length && sortedMatches.length > 0 ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            全选
          </button>
        </div>
        <BatchDeleteBar selected={selectedMatches} onDelete={batchRemoveMatches} onClear={() => setSelectedMatches([])} />
        {loadingMatches ? <Spinner /> : (
        <div className="divide-y divide-gray-100">
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
                <div className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                  <button onClick={(e) => { e.stopPropagation(); toggleMatchSelect(m.id); }} className="text-gray-300 hover:text-primary shrink-0">
                    {selectedMatches.includes(m.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div
                    onClick={() => setExpandMatchId(isExpanded ? null : m.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    <span className="text-xs text-gray-400 w-20 shrink-0">{new Date(m.date).toLocaleDateString('zh-CN')}</span>
                    <span className="text-sm font-medium text-gray-900 min-w-0 truncate">{teamA?.name || '?'} <span className="text-xs text-gray-500">{m.scoreA}:{m.scoreB}</span> {teamB?.name || '?'}</span>
                    <span className="text-xs text-gray-400 shrink-0">[{m.format.toUpperCase()}]</span>
                    <span className="text-xs text-gray-400 shrink-0">{tournament?.name}</span>
                  </div>
                </div>

                {/* Expanded: Maps */}
                {isExpanded && (
                  <div className="bg-gray-50/50 border-t border-gray-100 px-4 py-3 space-y-3">
                    {matchMaps.map(mm => {
                      const mapExpanded = expandMapId === mm.id;
                      const mapStats = (allStats || []).filter(s => s.matchMapId === mm.id);
                      return (
                        <div key={mm.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                          <div
                            onClick={() => setExpandMapId(mapExpanded ? null : mm.id)}
                            className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-2">
                              {mapExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                              <span className="text-sm font-medium text-gray-700">{mm.mapName}</span>
                              <span className="text-xs text-gray-400">({mm.scoreA}:{mm.scoreB})</span>
                            </div>
                            <span className="text-xs text-gray-400">{mapStats.length} 条数据</span>
                          </div>

                          {mapExpanded && (
                            <div className="border-t border-gray-100">
                              {/* Existing stats */}
                              {mapStats.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-gray-100">
                                        <th className="text-left px-2 py-1.5 text-gray-400 font-medium">选手</th>
                                        <th className="text-center px-1.5 py-1.5 text-gray-400 font-medium">K</th>
                                        <th className="text-center px-1.5 py-1.5 text-gray-400 font-medium">D</th>
                                        <th className="text-center px-1.5 py-1.5 text-gray-400 font-medium">A</th>
                                        <th className="text-center px-1.5 py-1.5 text-gray-400 font-medium">ADR</th>
                                        <th className="text-center px-1.5 py-1.5 text-gray-400 font-medium">Rating</th>
                                        <th className="text-center px-1.5 py-1.5 text-gray-400 font-medium">HS%</th>
                                        <th className="text-center px-1.5 py-1.5 text-gray-400 font-medium">首杀</th>
                                        <th className="text-center px-1.5 py-1.5 text-gray-400 font-medium">残局</th>
                                        <th className="w-8"></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {mapStats.sort((a, b) => b.rating - a.rating).map(s => {
                                        const p = players?.find(x => x.id === s.playerId);
                                        return (
                                          <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                                            <td className="px-2 py-1.5 font-medium text-gray-700">{p?.nickname || '?'}</td>
                                            <td className="text-center px-1.5 py-1.5 text-green-600 font-mono">{s.kills}</td>
                                            <td className="text-center px-1.5 py-1.5 text-red-500 font-mono">{s.deaths}</td>
                                            <td className="text-center px-1.5 py-1.5 text-gray-600 font-mono">{s.assists}</td>
                                            <td className="text-center px-1.5 py-1.5 text-gray-700 font-mono">{s.adr.toFixed(1)}</td>
                                            <td className={`text-center px-1.5 py-1.5 font-mono font-bold ${s.rating >= 1.2 ? 'text-green-600' : s.rating < 0.9 ? 'text-red-500' : 'text-gray-700'}`}>{s.rating.toFixed(2)}</td>
                                            <td className="text-center px-1.5 py-1.5 text-gray-500 font-mono">{s.headshotPercent}%</td>
                                            <td className="text-center px-1.5 py-1.5 text-gray-700 font-mono">{s.entryKills}</td>
                                            <td className="text-center px-1.5 py-1.5 text-gray-700 font-mono">{s.clutches}</td>
                                            <td><button onClick={() => deleteStat(s.id)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button></td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Add/Edit Stat Form */}
                              <div className="border-t border-gray-100 p-3">
                                {editingStat && editingStat.matchMapId === mm.id ? (
                                  <div>
                                    <p className="text-xs font-medium text-gray-700 mb-2">添加选手数据</p>
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                      <select value={editingStat.playerId} onChange={e => setEditingStat({ ...editingStat, playerId: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs col-span-3 sm:col-span-2">
                                        <option value="">选择选手</option>
                                        {teamPlayers.map(pid => {
                                          const p = players?.find(x => x.id === pid);
                                          return p ? <option key={pid} value={pid}>{p.nickname}</option> : null;
                                        })}
                                      </select>
                                      <input placeholder="K" value={editingStat.kills} onChange={e => setEditingStat({ ...editingStat, kills: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs w-full" type="number" />
                                      <input placeholder="D" value={editingStat.deaths} onChange={e => setEditingStat({ ...editingStat, deaths: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs w-full" type="number" />
                                      <input placeholder="A" value={editingStat.assists} onChange={e => setEditingStat({ ...editingStat, assists: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs w-full" type="number" />
                                      <input placeholder="ADR" value={editingStat.adr} onChange={e => setEditingStat({ ...editingStat, adr: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs w-full" type="number" step="0.1" />
                                      <input placeholder="Rating" value={editingStat.rating} onChange={e => setEditingStat({ ...editingStat, rating: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs w-full" type="number" step="0.01" />
                                      <input placeholder="KPR" value={editingStat.kpr} onChange={e => setEditingStat({ ...editingStat, kpr: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs w-full" type="number" step="0.01" />
                                      <input placeholder="HS%" value={editingStat.hs} onChange={e => setEditingStat({ ...editingStat, hs: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs w-full" type="number" />
                                      <input placeholder="首杀" value={editingStat.entry} onChange={e => setEditingStat({ ...editingStat, entry: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs w-full" type="number" />
                                      <input placeholder="残局" value={editingStat.clutches} onChange={e => setEditingStat({ ...editingStat, clutches: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs w-full" type="number" />
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                      <button onClick={saveStat} className="px-3 py-1 bg-primary text-white rounded text-xs">保存</button>
                                      <button onClick={() => setEditingStat(null)} className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-xs">取消</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={() => startAddStat(mm.id)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                                    <Plus className="w-3 h-3" /> 添加选手数据
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
