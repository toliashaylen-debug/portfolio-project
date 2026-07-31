import { useEffect, useState } from 'react';
import type { ConfigsById, DeskConfig, Histories, History, PortfolioId } from './types';
import { PORTFOLIO_IDS } from './lib/constants';
import { safeGet, verifiedSet, onKeyChange } from './lib/storage';
import BrandMark from './components/BrandMark';
import SetupWizard from './pages/SetupWizard';
import LoginGate from './pages/LoginGate';
import OverviewPage from './pages/OverviewPage';
import DeskViewPage from './pages/DeskViewPage';
import CommonPositionsPage from './pages/CommonPositionsPage';
import RisksPage from './pages/RisksPage';
import PortfolioFullPage from './pages/PortfolioFullPage';
import CommentaryPage from './pages/CommentaryPage';

type Phase = 'loading' | 'setup' | 'locked' | 'unlocked';

interface NavItem {
  key: string;
  label: string;
  sub?: string;
}

function buildNavItems(configsById: ConfigsById): NavItem[] {
  return [
    { key: 'overview', label: 'Overview' },
    { key: 'desk', label: 'Desk view' },
    { key: 'common', label: 'Common Positions' },
    { key: 'risks', label: 'Risks' },
    ...PORTFOLIO_IDS.map((id) => ({ key: id, label: configsById[id].name, sub: configsById[id].strategy })),
    { key: 'commentary', label: 'Commentary' },
  ];
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [config, setConfig] = useState<DeskConfig | null>(null);
  const [histories, setHistories] = useState<Histories>({} as Histories);
  const [page, setPage] = useState('overview');

  useEffect(() => {
    (async () => {
      const raw = await safeGet('desk-config');
      if (!raw) { setPhase('setup'); return; }
      const cfg: DeskConfig = JSON.parse(raw);
      const hh = {} as Histories;
      for (const id of PORTFOLIO_IDS) {
        const hr = await safeGet('history-' + id);
        hh[id] = hr ? JSON.parse(hr) : [];
      }
      setConfig(cfg);
      setHistories(hh);
      setPhase('locked');
    })();
  }, []);

  // Live sync: pick up config/history changes made by other people on other
  // devices without needing a manual refresh.
  useEffect(() => {
    const unsubs = [
      onKeyChange('desk-config', (value) => {
        if (value) setConfig(JSON.parse(value));
      }),
      ...PORTFOLIO_IDS.map((id) =>
        onKeyChange('history-' + id, (value) => {
          setHistories((prev) => ({ ...prev, [id]: value ? JSON.parse(value) : [] }));
        })
      ),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  function goTo(p: string) { setPage(p); }

  function updateHistory(id: PortfolioId, newHist: History) {
    setHistories((prev) => ({ ...prev, [id]: newHist }));
  }

  async function updateStrategy(id: PortfolioId, strategy: string) {
    if (!config) return;
    const newConfig = { ...config, portfolios: config.portfolios.map((p) => (p.id === id ? { ...p, strategy } : p)) };
    setConfig(newConfig);
    await verifiedSet('desk-config', JSON.stringify(newConfig));
  }

  async function updateName(id: PortfolioId, name: string) {
    if (!config) return;
    const newConfig = { ...config, portfolios: config.portfolios.map((p) => (p.id === id ? { ...p, name } : p)) };
    setConfig(newConfig);
    await verifiedSet('desk-config', JSON.stringify(newConfig));
  }

  if (phase === 'loading') {
    return (
      <div className="desk-app">
        <div className="desk-gate"><div className="desk-note">Loading the desk…</div></div>
      </div>
    );
  }

  if (phase === 'setup') {
    return (
      <div className="desk-app">
        <SetupWizard
          onComplete={(cfg) => {
            setConfig(cfg);
            const hh = {} as Histories;
            PORTFOLIO_IDS.forEach((id) => { hh[id] = []; });
            setHistories(hh);
            setPhase('locked');
          }}
        />
      </div>
    );
  }

  if (phase === 'locked' || !config) {
    return (
      <div className="desk-app">
        <LoginGate config={config as DeskConfig} onUnlock={() => setPhase('unlocked')} />
      </div>
    );
  }

  const configsById = {} as ConfigsById;
  config.portfolios.forEach((p) => { configsById[p.id] = p; });
  const navItems = buildNavItems(configsById);

  let pageEl;
  if (page === 'overview') pageEl = <OverviewPage configs={configsById} histories={histories} goTo={goTo} />;
  else if (page === 'desk') pageEl = <DeskViewPage configs={configsById} histories={histories} />;
  else if (page === 'common') pageEl = <CommonPositionsPage configs={configsById} histories={histories} />;
  else if (page === 'risks') pageEl = <RisksPage configs={configsById} histories={histories} />;
  else if ((PORTFOLIO_IDS as string[]).includes(page)) {
    const pid = page as PortfolioId;
    pageEl = (
      <PortfolioFullPage
        key={pid}
        id={pid}
        configs={configsById}
        histories={histories}
        onHistoryChange={updateHistory}
        onStrategyChange={updateStrategy}
        onNameChange={updateName}
      />
    );
  } else if (page === 'commentary') {
    pageEl = <CommentaryPage configs={configsById} histories={histories} />;
  }

  return (
    <div className="desk-app">
      <div className="desk-shell">
        <div className="desk-nav">
          <div className="desk-nav-brand">
            <BrandMark />
            <div className="brand-text">
              <div className="eyebrow">Safra</div>
              <h1 className="display">Banking</h1>
            </div>
          </div>
          {navItems.map((item) => (
            <div
              key={item.key}
              className={'desk-nav-item' + (page === item.key ? ' active' : '')}
              onClick={() => setPage(item.key)}
            >
              {item.label}
              {item.sub ? <span className="strategy-tag" title={item.sub}>{item.sub}</span> : null}
            </div>
          ))}
          <div className="desk-nav-foot">
            <button onClick={() => setPhase('locked')}>Lock desk</button>
          </div>
        </div>
        <div className="desk-main">{pageEl}</div>
      </div>
    </div>
  );
}
