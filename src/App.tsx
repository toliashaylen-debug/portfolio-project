import { useEffect, useState } from 'react';
import type { ConfigsById, DeskConfig, Histories, History, PortfolioId } from './types';
import { PORTFOLIO_IDS } from './lib/constants';
import { safeGet, verifiedSet, onKeyChange } from './lib/storage';
import { BrandLockup } from './components/BrandMark';
import HomePage from './pages/HomePage';
import SetupWizard from './pages/SetupWizard';
import LoginGate from './pages/LoginGate';
import OverviewPage from './pages/OverviewPage';
import DeskViewPage from './pages/DeskViewPage';
import CommonPositionsPage from './pages/CommonPositionsPage';
import RisksPage from './pages/RisksPage';
import PortfolioFullPage from './pages/PortfolioFullPage';
import CommentaryPage from './pages/CommentaryPage';

type Phase = 'home' | 'loading' | 'setup' | 'locked' | 'unlocked';

interface NavItem {
  key: string;
  label: string;
  sub?: string;
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

function buildNavSections(configsById: ConfigsById): NavSection[] {
  return [
    {
      heading: 'The desk',
      items: [
        { key: 'overview', label: 'Overview' },
        { key: 'desk', label: 'Desk view' },
        { key: 'common', label: 'Common Positions' },
        { key: 'risks', label: 'Risks' },
      ],
    },
    {
      heading: 'Portfolios',
      items: PORTFOLIO_IDS.map((id) => ({ key: id, label: configsById[id].name, sub: configsById[id].strategy })),
    },
    {
      heading: 'Desk notes',
      items: [{ key: 'commentary', label: 'Commentary' }],
    },
  ];
}

export default function App() {
  // Start on the public homepage; the desk itself sits behind "Enter the desk".
  const [phase, setPhase] = useState<Phase>('home');
  const [config, setConfig] = useState<DeskConfig | null>(null);
  const [histories, setHistories] = useState<Histories>({} as Histories);
  const [page, setPage] = useState('overview');
  // null = still loading, true/false = whether a desk has been set up
  const [hasConfig, setHasConfig] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await safeGet('desk-config');
      if (!raw) { setHasConfig(false); return; }
      const cfg: DeskConfig = JSON.parse(raw);
      const hh = {} as Histories;
      for (const id of PORTFOLIO_IDS) {
        const hr = await safeGet('history-' + id);
        hh[id] = hr ? JSON.parse(hr) : [];
      }
      setConfig(cfg);
      setHistories(hh);
      setHasConfig(true);
    })();
  }, []);

  // If the visitor hits "Enter the desk" before bootstrap finishes, hold them on
  // the loading screen and move them along as soon as we know which gate to show.
  useEffect(() => {
    if (phase === 'loading' && hasConfig !== null) setPhase(hasConfig ? 'locked' : 'setup');
  }, [phase, hasConfig]);

  function enterDesk() {
    if (hasConfig === null) setPhase('loading');
    else setPhase(hasConfig ? 'locked' : 'setup');
  }

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

  if (phase === 'home') return <HomePage onEnter={enterDesk} />;

  if (phase === 'loading') {
    return (
      <div className="desk-app">
        <div className="desk-gate">
          <div className="desk-gate-box" style={{ textAlign: 'center' }}>
            <div className="desk-note" style={{ marginTop: 0 }}><span className="desk-spin" />Loading the desk…</div>
          </div>
        </div>
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
            setHasConfig(true);
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
  const navSections = buildNavSections(configsById);

  const activeSection = navSections.find((s) => s.items.some((i) => i.key === page))?.heading ?? 'The desk';
  const activeLabel = navSections.flatMap((s) => s.items).find((i) => i.key === page)?.label ?? 'Overview';
  // Most recent snapshot date across every book, for the header's context line.
  const lastUpdated = PORTFOLIO_IDS
    .map((id) => (histories[id] || []).slice(-1)[0]?.date)
    .filter(Boolean)
    .sort()
    .pop() ?? null;

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
            <BrandLockup size={30} variant="light" subtitle="Private Desk" />
          </div>
          <div className="desk-nav-sections">
            {navSections.map((section) => (
              <div className="desk-nav-group" key={section.heading}>
                <div className="desk-nav-section">{section.heading}</div>
                {section.items.map((item) => (
                  <div
                    key={item.key}
                    className={'desk-nav-item' + (page === item.key ? ' active' : '')}
                    onClick={() => setPage(item.key)}
                  >
                    {item.label}
                    {item.sub ? <span className="strategy-tag" title={item.sub}>{item.sub}</span> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="desk-nav-foot">
            <button onClick={() => setPhase('home')}>Lock desk &amp; sign out</button>
          </div>
        </div>
        <div className="desk-main">
          <div className="desk-topbar">
            <div className="desk-crumb">
              <span>{activeSection}</span>
              <span className="desk-crumb-sep">/</span>
              <strong>{activeLabel}</strong>
            </div>
            <div className="desk-topbar-meta">
              {lastUpdated ? <span>Last snapshot {lastUpdated}</span> : null}
            </div>
          </div>
          {pageEl}
        </div>
      </div>
    </div>
  );
}
