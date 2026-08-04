import type { ConfigsById, Histories, PortfolioId } from '../types';
import { PORTFOLIO_IDS } from '../lib/constants';
import { BrandLockup } from '../components/BrandMark';

/**
 * Landing page after sign-in. Four boxes: one per participant, plus the
 * comparison. Choosing a participant opens only their book; the comparison
 * holds everything that spans all three.
 */
export default function HubPage({ configs, histories, onOpen, onLock }: {
  configs: ConfigsById;
  histories: Histories;
  onOpen: (key: string) => void;
  onLock: () => void;
}) {
  const projectName = (id: PortfolioId) => {
    const raw = configs[id].name.replace(/'s Portfolio$/i, '').replace(/\s+Portfolio$/i, '');
    return `${raw}'s Project`;
  };

  return (
    <div className="hub">
      <header className="hub-topbar">
        <BrandLockup size={32} variant="light" subtitle="Private Investment Desk" />
        <button className="desk-btn on-dark ghost" onClick={onLock}>Lock desk &amp; sign out</button>
      </header>

      <main className="hub-main">
        <div className="hub-inner">
          <div className="hub-head">
            <div className="home-rule" />
            <h1 className="hub-title">Select a project</h1>
            <p className="hub-lede">
              Each project opens on its own. The comparison brings all three books together.
            </p>
          </div>

          <div className="hub-grid">
            {PORTFOLIO_IDS.map((id) => {
              const hist = histories[id] || [];
              const latest = hist.length ? hist[hist.length - 1] : null;
              return (
                <button className="hub-box" key={id} onClick={() => onOpen(id)}>
                  <span className="hub-box-eyebrow">Portfolio</span>
                  <span className="hub-box-title">{projectName(id)}</span>
                  <span className="hub-box-sub">{configs[id].strategy}</span>
                  <span className="hub-box-foot">
                    {latest
                      ? `${latest.positions.length} positions · last updated ${latest.date}`
                      : 'No positions uploaded yet'}
                    <span className="hub-box-arrow" aria-hidden="true">→</span>
                  </span>
                </button>
              );
            })}

            <button className="hub-box comparison" onClick={() => onOpen('overview')}>
              <span className="hub-box-eyebrow">All three books</span>
              <span className="hub-box-title">Comparison</span>
              <span className="hub-box-sub">
                Overview, desk view, common positions, risks and the daily commentary — every book side by side.
              </span>
              <span className="hub-box-foot">
                Cross-portfolio
                <span className="hub-box-arrow" aria-hidden="true">→</span>
              </span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
