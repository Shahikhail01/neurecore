// ─── DailyBriefingService.ts ──────────────────────────────────────────────────
// SRP : Fetches metrics → builds briefing narrative → drives browser TTS.
// OCP : Section builders are data-driven arrays (add entries, no logic change).
// DIP : Depends on IRepository abstractions from core layer.

import type {
  IDailyBriefingService,
  DailyBriefing,
  BriefingSection,
} from '@/core/services/interfaces/IDailyBriefingService';
import { agentRepository }      from '@/core/repositories/AgentRepository';
import { taskRepository }       from '@/core/repositories/TaskRepository';
import { departmentRepository } from '@/core/repositories/DepartmentRepository';

const TODAY_KEY = () => new Date().toISOString().slice(0, 10);

export class DailyBriefingService implements IDailyBriefingService {
  private _cached: DailyBriefing | null = null;
  private _cacheDate = '';
  private _utterance: SpeechSynthesisUtterance | null = null;
  private _isSpeaking = false;

  // ─── IDailyBriefingReader ────────────────────────────────────────────────

  async getBriefing(): Promise<DailyBriefing> {
    const today = TODAY_KEY();
    if (this._cached && this._cacheDate === today) return this._cached;

    const [agentResult, taskResult, deptResult] = await Promise.all([
      agentRepository.findAll(),
      taskRepository.findAll(),
      departmentRepository.findAll(),
    ]);

    const agents = agentResult.items;
    const tasks  = taskResult.items;
    const depts  = deptResult.items;

    const activeAgents    = agents.filter((a) => a.status === 'ACTIVE').length;
    const errorAgents     = agents.filter((a) => a.status === 'ERROR').length;
    const completedToday  = tasks.filter((t) => {
      if (t.status !== 'COMPLETED' || !t.completedAt) return false;
      return t.completedAt.startsWith(today);
    }).length;
    const pendingTasks    = tasks.filter((t) => t.status === 'PENDING' || t.status === 'ASSIGNED').length;
    const failedTasks     = tasks.filter((t) => t.status === 'FAILED').length;
    const harmonyScores   = depts.map((d) => d.harmonyScore).filter(Boolean);
    const avgHarmony      = harmonyScores.length
      ? Math.round(harmonyScores.reduce((s, v) => s + v, 0) / harmonyScores.length)
      : 0;

    const sections: BriefingSection[] = [
      {
        title:      'Team Status',
        summary:    `${activeAgents} of ${agents.length} agents are active right now.` +
          (errorAgents > 0 ? ` ${errorAgents} agent${errorAgents > 1 ? 's need' : ' needs'} attention.` : ' All systems running smoothly.'),
        value:      activeAgents,
        valueLabel: 'active',
        severity:   errorAgents > 0 ? 'warning' : 'positive',
      },
      {
        title:      'Task Progress',
        summary:    `Your team completed ${completedToday} task${completedToday !== 1 ? 's' : ''} today.` +
          (pendingTasks > 0 ? ` ${pendingTasks} task${pendingTasks > 1 ? 's are' : ' is'} still in queue.` : ''),
        value:      completedToday,
        valueLabel: 'completed',
        trend:      completedToday > 5 ? 'up' : 'flat',
        severity:   failedTasks > 3 ? 'negative' : 'positive',
      },
      {
        title:      'Team Harmony',
        summary:    avgHarmony >= 75
          ? `Your AI team is collaborating beautifully — harmony score is ${avgHarmony}%.`
          : avgHarmony >= 50
            ? `Team harmony is at ${avgHarmony}%. A few handoff bottlenecks detected.`
            : `Team harmony needs attention — score is ${avgHarmony}%. Consider reviewing department workloads.`,
        value:      avgHarmony,
        valueLabel: '% harmony',
        severity:   avgHarmony >= 75 ? 'positive' : avgHarmony >= 50 ? 'neutral' : 'warning',
      },
    ];

    if (failedTasks > 0) {
      sections.push({
        title:    'Alerts',
        summary:  `${failedTasks} task${failedTasks > 1 ? 's' : ''} failed and require your review.`,
        value:    failedTasks,
        severity: 'negative',
        trend:    'down',
      });
    }

    const score = Math.round(
      (activeAgents / Math.max(1, agents.length)) * 30 +
      (completedToday > 0 ? Math.min(completedToday / 10, 1) * 30 : 0) +
      (avgHarmony / 100) * 40,
    );

    const headline =
      score >= 80 ? "Your team is performing exceptionally today 🚀" :
      score >= 60 ? "Good progress — a few items need your attention." :
      "Your team needs some guidance today. Let's get things back on track.";

    const briefing: DailyBriefing = {
      date:        today,
      headline,
      overallScore: score,
      sections,
      generatedAt: new Date().toISOString(),
    };

    this._cached    = briefing;
    this._cacheDate = today;
    return briefing;
  }

  invalidate(): void {
    this._cached    = null;
    this._cacheDate = '';
  }

  // ─── IDailyBriefingNarrator ──────────────────────────────────────────────

  isNarrationSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  narrate(briefing: DailyBriefing): () => void {
    if (!this.isNarrationSupported()) return () => undefined;

    this.stopNarration();

    const script = this._buildScript(briefing);
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate  = 0.95;
    utterance.pitch = 1.0;
    utterance.lang  = 'en-US';

    utterance.onstart = () => { this._isSpeaking = true; };
    utterance.onend   = () => { this._isSpeaking = false; };
    utterance.onerror = () => { this._isSpeaking = false; };

    this._utterance = utterance;
    window.speechSynthesis.speak(utterance);
    this._isSpeaking = true;

    return () => this.stopNarration();
  }

  stopNarration(): void {
    if (!this.isNarrationSupported()) return;
    window.speechSynthesis.cancel();
    this._isSpeaking = false;
    this._utterance  = null;
  }

  private _buildScript(b: DailyBriefing): string {
    const lines = [
      `Good ${this._timeOfDay()}. Here's your daily briefing for ${this._formatDate(b.date)}.`,
      b.headline,
      '',
      ...b.sections.map((s) => `${s.title}. ${s.summary}`),
      '',
      `Overall company score: ${b.overallScore} out of 100.`,
      b.overallScore >= 80
        ? 'Great work — keep up the momentum.'
        : "Let's make today even better. You've got this.",
    ];
    return lines.join(' ').replace(/\s{2,}/g, ' ').trim();
  }

  private _timeOfDay(): string {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }

  private _formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  }
}

export const dailyBriefingService = new DailyBriefingService();
