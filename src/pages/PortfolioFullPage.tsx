import type { ConfigsById, Histories, History, PortfolioId } from '../types';
import PortfolioPage from './PortfolioPage';
import AnnualGraphPage from './AnnualGraphPage';
import BenchmarkComparisonPage from './BenchmarkComparisonPage';

// Everything for one person — portfolio detail, Monte Carlo projection, and
// benchmark comparison — stacked on a single scrollable page under one nav
// tab, rather than split across three separate tabs.
export default function PortfolioFullPage({ id, configs, histories, onHistoryChange, onStrategyChange, onNameChange }: {
  id: PortfolioId;
  configs: ConfigsById;
  histories: Histories;
  onHistoryChange: (id: PortfolioId, newHist: History) => void;
  onStrategyChange: (id: PortfolioId, strategy: string) => void;
  onNameChange: (id: PortfolioId, name: string) => void;
}) {
  const cfg = configs[id];
  const history = histories[id] || [];
  const sectionDivider = <div style={{ borderTop: '1px solid var(--border)', margin: 'var(--sp-7) 0' }} />;

  return (
    <div>
      <PortfolioPage
        id={id}
        configs={configs}
        histories={histories}
        onHistoryChange={onHistoryChange}
        onStrategyChange={onStrategyChange}
        onNameChange={onNameChange}
      />
      {sectionDivider}
      <AnnualGraphPage id={id} cfg={cfg} history={history} />
      {sectionDivider}
      <BenchmarkComparisonPage id={id} cfg={cfg} />
    </div>
  );
}
