import { isMuted, setMuted, sfx } from '../audio/sfx';
import { COLORS } from '../config';
import { COSTS, type Tool } from '../sim/city';
import { formatRupees } from '../sim/format';

interface ToolInfo {
  tool: Tool;
  icon: string;
  label: string;
  /** Keyboard shortcut. */
  key: string;
  cost?: number;
  /** Colour of the zone on the map, shown under the button. */
  swatch?: number;
}

const TOOLS: ToolInfo[] = [
  { tool: 'pan', icon: '✋', label: 'Move', key: '1' },
  { tool: 'road', icon: '🛣️', label: 'Road', key: '2', cost: COSTS.road },
  { tool: 'homes', icon: '🏠', label: 'Homes', key: '3', cost: COSTS.zone, swatch: COLORS.homes },
  { tool: 'shops', icon: '🛍️', label: 'Shops', key: '4', cost: COSTS.zone, swatch: COLORS.shops },
  { tool: 'offices', icon: '💻', label: 'IT Offices', key: '5', cost: COSTS.zone, swatch: COLORS.offices },
  { tool: 'bulldoze', icon: '🚜', label: 'Bulldoze', key: '6', cost: COSTS.bulldoze },
];

/** The HTML around the map: money, the toolbar, little messages and the welcome card. */
export class Hud {
  /** Set by the city scene so it hears about tool changes. */
  onToolChange: (tool: Tool) => void = () => {};

  private readonly money = byId('money');
  private readonly toastBox = byId('toast');
  private readonly buttons = new Map<Tool, HTMLButtonElement>();
  private toastTimer = 0;
  private shownMoney: number | null = null;

  constructor() {
    const toolbar = byId('toolbar');
    for (const info of TOOLS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tool';
      button.title = `${info.label} (${info.key})`;
      button.append(span('icon', info.icon), span('label', info.label));
      if (info.cost !== undefined) button.append(span('cost', formatRupees(info.cost)));
      if (info.swatch !== undefined) {
        const swatch = span('swatch', '');
        swatch.style.background = `#${info.swatch.toString(16).padStart(6, '0')}`;
        button.append(swatch);
      }
      button.addEventListener('click', () => {
        sfx.click();
        this.selectTool(info.tool);
      });
      toolbar.append(button);
      this.buttons.set(info.tool, button);
    }
    this.markPressed('pan');

    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const match = TOOLS.find((info) => info.key === event.key);
      if (match) this.selectTool(match.tool);
      else if (event.key === 'Escape') this.selectTool('pan');
    });

    const sound = byId('sound');
    const showSound = () => {
      sound.textContent = isMuted() ? '🔇' : '🔊';
      sound.setAttribute('aria-label', isMuted() ? 'Turn sound on' : 'Turn sound off');
    };
    sound.addEventListener('click', () => {
      setMuted(!isMuted());
      showSound();
      sfx.click();
    });
    showSound();

    byId('start').addEventListener('click', () => {
      this.hideWelcome();
      sfx.coin();
      this.selectTool('road');
    });
  }

  selectTool(tool: Tool): void {
    this.markPressed(tool);
    this.onToolChange(tool);
  }

  setMoney(amount: number): void {
    this.money.textContent = formatRupees(amount);
    if (this.shownMoney !== null && amount !== this.shownMoney) {
      // Restart the little bounce animation.
      this.money.classList.remove('bump');
      void this.money.offsetWidth;
      this.money.classList.add('bump');
    }
    this.shownMoney = amount;
  }

  toast(message: string, kind: 'info' | 'error' = 'info'): void {
    this.toastBox.textContent = message;
    this.toastBox.classList.toggle('error', kind === 'error');
    this.toastBox.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastBox.classList.remove('show'), 2400);
  }

  hideWelcome(): void {
    byId('welcome').classList.add('hidden');
  }

  private markPressed(tool: Tool): void {
    for (const [t, button] of this.buttons) button.setAttribute('aria-pressed', String(t === tool));
  }
}

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`index.html is missing #${id}`);
  return element;
}

function span(className: string, text: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  return element;
}
