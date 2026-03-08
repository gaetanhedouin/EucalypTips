import type { LeaderboardRow, WidgetPayload } from '@nouveau/types';

interface WidgetOptions {
  widgetKey: string;
  apiBaseUrl: string;
  window: 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'ALL_TIME' | 'CUSTOM';
  sport?: 'FOOTBALL' | 'BASKETBALL' | 'TENNIS';
}

function createStyles(target: ShadowRoot): void {
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      font-family: ui-sans-serif, -apple-system, Segoe UI, sans-serif;
      color: #122419;
    }
    .wrap {
      border: 1px solid #d9e6d3;
      background: linear-gradient(160deg, #ffffff 0%, #f4faf1 100%);
      border-radius: 14px;
      padding: 14px;
      width: 100%;
      box-sizing: border-box;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    h3 {
      margin: 0;
      font-size: 16px;
      letter-spacing: -0.01em;
    }
    .badge {
      border: 1px solid #c7dbca;
      color: #1f5a3d;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th,
    td {
      border-bottom: 1px solid #e9f1e5;
      text-align: left;
      padding: 7px 6px;
    }
    .muted {
      color: #4d6656;
      font-size: 11px;
      margin-top: 8px;
    }
  `;
  target.appendChild(style);
}

function renderRows(rows: LeaderboardRow[]): string {
  if (rows.length === 0) {
    return '<tr><td colspan="5">No secure public data yet.</td></tr>';
  }

  return rows
    .slice(0, 10)
    .map(
      (row) => `
      <tr>
        <td>${row.sourceName}</td>
        <td>${row.sport}</td>
        <td>${row.totalBets}</td>
        <td>${(row.winRate * 100).toFixed(1)}%</td>
        <td>${(row.roi * 100).toFixed(1)}%</td>
      </tr>
    `,
    )
    .join('');
}

async function fetchWidgetData(options: WidgetOptions): Promise<WidgetPayload> {
  const params = new URLSearchParams({
    window: options.window,
    ...(options.sport ? { sport: options.sport } : {}),
  });

  const response = await fetch(
    `${options.apiBaseUrl.replace(/\/$/, '')}/v1/public/widgets/${options.widgetKey}/data?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Widget request failed: ${response.status}`);
  }

  return response.json() as Promise<WidgetPayload>;
}

function draw(target: ShadowRoot, payload: WidgetPayload, window: string): void {
  const rows = payload.rows;
  target.innerHTML = '';
  createStyles(target);

  const root = document.createElement('div');
  root.className = 'wrap';
  root.innerHTML = `
    <div class="head">
      <h3>Public Performance</h3>
      <span class="badge">${window}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Source</th>
          <th>Sport</th>
          <th>Bets</th>
          <th>Win</th>
          <th>ROI</th>
        </tr>
      </thead>
      <tbody>${renderRows(rows)}</tbody>
    </table>
    <div class="muted">Updated ${new Date(payload.generatedAt).toLocaleString()}</div>
  `;

  target.appendChild(root);
}

function resolveOptions(script: HTMLScriptElement): WidgetOptions {
  return {
    widgetKey: script.dataset.widgetKey ?? 'demo-public',
    apiBaseUrl: script.dataset.apiBaseUrl ?? 'http://localhost:4000',
    window: (script.dataset.window as WidgetOptions['window']) ?? 'WEEK',
    sport: script.dataset.sport as WidgetOptions['sport'] | undefined,
  };
}

async function mount(script: HTMLScriptElement): Promise<void> {
  const options = resolveOptions(script);
  const host = document.createElement('div');
  script.insertAdjacentElement('afterend', host);
  const shadow = host.attachShadow({ mode: 'open' });

  const load = async () => {
    try {
      const payload = await fetchWidgetData(options);
      draw(shadow, payload, options.window);
    } catch (error) {
      shadow.textContent = `Widget error: ${String(error)}`;
    }
  };

  await load();

  const source = new EventSource(`${options.apiBaseUrl.replace(/\/$/, '')}/v1/public/stream/leaderboard`);
  source.addEventListener('leaderboard.updated', () => {
    void load();
  });
}

function bootstrap(): void {
  const currentScript = document.currentScript as HTMLScriptElement | null;
  if (!currentScript) {
    return;
  }

  void mount(currentScript);
}

bootstrap();
