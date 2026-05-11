import type { AIProvider, ChatChunk, ChatOpts, ModelInfo, StructuredOpts } from './provider';

const ANSWERS: Array<{ keywords: RegExp; text: string }> = [
  {
    keywords: /\b(ai|llm|machine learning|regression ai agent|snowflake|azure|copilot)\b/i,
    text: `At LitePoint, Cameron is leading the engineering team's first AI project — the "Regression AI Agent" — built on Snowflake, Azure Blob Storage, Python, and Copilot Studio [work.0.highlights.4]. This is a fresh initiative as of 2026 and reflects a broader push at LitePoint into ML-augmented test automation. Cameron's hands-on AI experience pairs with a long firmware/hardware-debugging background, which gives him an unusual angle: he can connect ML pipelines back to the physical RF test instruments they're meant to support.`,
  },
  {
    keywords: /\b(devops|docker|jenkins|ci|cd)\b/i,
    text: `Cameron drove the LitePoint engineering team's adoption of Docker and worked with Jenkins to automate testing frameworks [work.0.highlights.5]. This was a cross-team initiative, not just personal tooling.`,
  },
  {
    keywords: /\b(linux|toolchain|visual studio|vs studio)\b/i,
    text: `Cameron led the LitePoint engineering team's effort to support Linux natively in the Visual Studio editor [work.0.highlights.6]. That's a non-trivial cross-platform integration effort given how Windows-centric the VS Studio stack has historically been.`,
  },
  {
    keywords: /\b(embedded|firmware|circuitpython|stm32|c\+\+|rf|microcontroller)\b/i,
    text: `Cameron has 6+ years of embedded experience [work.0.highlights.0]. Currently at LitePoint, he designs firmware in C++ for next-gen telecommunications test equipment and runs hardware test/debugging on RF devices from 0–60 GHz using Spectrum Analyzers and VNAs [work.0.highlights.2]. Prior roles include MC Countermeasures (military EW/ECM systems, 2018–2019) and MyPitboard (PCB design + GNSS-GPS data over UART/SPI, 2020).`,
  },
  {
    keywords: /\b(education|degree|school|university|uottawa)\b/i,
    text: `BASc in Electrical Engineering from the University of Ottawa (2014–2018).`,
  },
  {
    keywords: /\b(project|side project|leddisplay|5easy)\b/i,
    text: `Two current side projects worth mentioning: **LedDisplay** (CircuitPython matrix clock on Adafruit Matrix Portal S3, with an investigation of an undocumented HUB75 panel scan mode), and **5easy** (full-stack D&D 5e character manager — TypeScript + Supabase). Earlier academic/work projects include a Qt+Python testing interface for high-power RF amplifiers (2019) and a solar microinverter with software PLL on Arduino Uno (2018).`,
  },
];

const FALLBACK = `I can answer questions about Cameron's work at LitePoint, his earlier hardware/firmware roles (MyPitboard, Tetra Tech, MC Countermeasures), his BASc from the University of Ottawa, and his current AI/DevOps/Linux work and side projects. Try asking about a specific area — embedded experience, AI, DevOps, or a particular role.`;

function pickAnswer(message: string): string {
  for (const a of ANSWERS) if (a.keywords.test(message)) return a.text;
  return FALLBACK;
}

export class DemoProvider implements AIProvider {
  id = 'demo' as const;
  displayName = 'Demo (no key needed)';
  models: ModelInfo[] = [{ id: 'demo', label: 'Demo', contextWindow: 0, supportsCaching: false }];
  defaultModel = 'demo';

  private lastCached = 0;

  async *chat(opts: ChatOpts): AsyncIterable<ChatChunk> {
    const last = opts.messages.findLast?.((m) => m.role === 'user');
    const userMsg = last?.content ?? '';
    const answer = pickAnswer(userMsg);
    const tokens = answer.split(/(\s+)/);
    let total = 0;
    for (const tok of tokens) {
      if (opts.signal?.aborted) break;
      yield { type: 'text', delta: tok };
      total += tok.length;
      await sleep(25);
    }
    yield { type: 'done', totalTokens: total };
  }

  async structured<T>(opts: StructuredOpts<T>): Promise<T> {
    // Demo provider returns a fake fit-score JD-analyzer response shape.
    // Callers that want real structured output should connect a real provider.
    const placeholder = {
      fit_score: 72,
      matched_skills: [
        { skill: 'Python', evidence: 'work.0.highlights.1' },
        { skill: 'Docker', evidence: 'work.0.highlights.5' },
      ],
      gaps: ['No specific cloud-native production experience listed'],
      tailored_intro:
        'Cameron is a 6-year software engineer with hands-on AI, DevOps, and embedded experience. His current role at LitePoint includes leading their first AI project and driving Docker/Jenkins adoption — directly relevant signals for the role.',
      suggested_questions: [
        'Can you walk me through the Regression AI Agent architecture?',
        'How did you sequence the Docker rollout at LitePoint?',
      ],
    };
    return opts.schema.parse(placeholder);
  }

  lastCachedTokens(): number {
    return this.lastCached;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
