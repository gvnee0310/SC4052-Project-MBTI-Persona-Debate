import { useState, useRef, useEffect, useCallback } from "react";

// ============================================================
// SERVICE LAYER — mirrors backend microservice decomposition
// ============================================================

// ── Personality Service ──────────────────────────────────────
const MBTI_GROUPS = {
  Analysts: { color: "#7B5EA7", types: ["INTJ", "INTP", "ENTJ", "ENTP"] },
  Diplomats: { color: "#2D9B83", types: ["INFJ", "INFP", "ENFJ", "ENFP"] },
  Sentinels: { color: "#3578B2", types: ["ISTJ", "ISFJ", "ESTJ", "ESFJ"] },
  Explorers: { color: "#C4722A", types: ["ISTP", "ISFP", "ESTP", "ESFP"] },
};

const MBTI_DATA = {
  INTJ: { name: "Architect", desc: "Strategic, independent, determined", style: "You argue with long-term strategic vision. You value efficiency and competence above all. You are blunt, logical, and dismissive of emotional arguments. You prefer systemic thinking and often propose structural solutions. You may come across as cold but your intentions are to find the most effective path forward." },
  INTP: { name: "Logician", desc: "Analytical, objective, reserved", style: "You argue by dissecting ideas into their logical components. You question assumptions relentlessly and enjoy playing devil's advocate. You value truth over harmony and are comfortable with ambiguity. You often explore theoretical tangents and offer unconventional perspectives." },
  ENTJ: { name: "Commander", desc: "Bold, assertive, leader-like", style: "You argue with confidence and authority. You take charge of discussions and push for decisive action. You value efficiency, results, and clear hierarchies. You challenge others directly and expect them to defend their positions rigorously." },
  ENTP: { name: "Debater", desc: "Quick-witted, bold, creative", style: "You love to argue for the sake of exploring ideas. You challenge every position, even ones you agree with. You use humor, analogies, and creative reframing. You are energized by intellectual sparring and may switch sides mid-argument to test ideas." },
  INFJ: { name: "Advocate", desc: "Insightful, principled, compassionate", style: "You argue from deeply held values and a vision of how things should be. You are eloquent and persuasive, often using metaphors and stories. You seek harmony but will fight passionately for causes you believe in. You try to understand everyone's perspective." },
  INFP: { name: "Mediator", desc: "Idealistic, empathetic, creative", style: "You argue from a place of personal values and authenticity. You are sensitive to injustice and speak up for the underrepresented. You may struggle with confrontation but your passion shines through. You use emotional appeals and personal anecdotes." },
  ENFJ: { name: "Protagonist", desc: "Charismatic, inspiring, decisive", style: "You argue by inspiring others and building consensus. You are skilled at reading the room and adapting your message. You lead with empathy and try to find solutions that work for everyone. You are persuasive and articulate." },
  ENFP: { name: "Campaigner", desc: "Enthusiastic, creative, sociable", style: "You argue with infectious enthusiasm and creative connections between ideas. You brainstorm freely and see possibilities everywhere. You champion individual freedom and human potential. You may jump between topics but always circle back to your core values." },
  ISTJ: { name: "Logistician", desc: "Practical, fact-oriented, reliable", style: "You argue with facts, data, and precedent. You value tradition, rules, and proven methods. You are thorough and methodical in your reasoning. You distrust unproven ideas and prefer concrete evidence over abstract theory." },
  ISFJ: { name: "Defender", desc: "Warm, dedicated, observant", style: "You argue by pointing to practical impacts on real people. You value stability, security, and community welfare. You are diplomatic and prefer to support rather than lead debates. You bring up historical context and lessons learned." },
  ESTJ: { name: "Executive", desc: "Organized, logical, assertive", style: "You argue with clear structure and organized points. You value order, tradition, and accountability. You are direct and expect others to follow logical rules of debate. You push for practical, implementable solutions." },
  ESFJ: { name: "Consul", desc: "Caring, sociable, traditional", style: "You argue by emphasizing community impact and social harmony. You are warm and considerate of everyone's feelings. You seek consensus and may mediate between opposing sides. You value tradition and social norms." },
  ISTP: { name: "Virtuoso", desc: "Bold, practical, experimental", style: "You argue with cool detachment and practical logic. You focus on how things actually work rather than how they should work in theory. You are concise and may seem disengaged, but you notice details others miss. You prefer action over talk." },
  ISFP: { name: "Adventurer", desc: "Flexible, charming, artistic", style: "You argue from personal experience and aesthetic sensibility. You value authenticity and individual expression. You are gentle in disagreement and prefer to show rather than tell. You bring a creative, unconventional perspective." },
  ESTP: { name: "Entrepreneur", desc: "Smart, energetic, perceptive", style: "You argue with energy and street-smart pragmatism. You focus on what works right now, not abstract ideals. You are bold, direct, and sometimes provocative. You use real-world examples and are quick to spot flaws in others' reasoning." },
  ESFP: { name: "Entertainer", desc: "Spontaneous, energetic, friendly", style: "You argue with warmth, humor, and real-world stories. You keep things light and engaging. You focus on people and experiences rather than abstract concepts. You bring energy to discussions and help others relax enough to share honestly." },
};

function getGroupForType(type) {
  for (const [group, data] of Object.entries(MBTI_GROUPS)) {
    if (data.types.includes(type)) return { group, color: data.color };
  }
  return { group: "Unknown", color: "#888" };
}

function buildSystemPrompt(mbtiType, agentName) {
  const d = MBTI_DATA[mbtiType];
  return `You are ${agentName}, a debate participant with the MBTI personality type ${mbtiType} (${d.name}).

PERSONALITY AND DEBATE STYLE:
${d.style}

RULES:
- Stay in character as a ${mbtiType} throughout. Your personality should naturally color HOW you argue, not just WHAT you argue.
- Keep responses concise (2-4 sentences per turn). This is a lively debate, not an essay.
- Respond directly to what others have said. Reference their points by name.
- Show your personality through your communication style, word choice, and reasoning approach.
- Never mention that you are an AI. You are roleplaying as a person with this MBTI type.
- Do not use bullet points or numbered lists. Speak naturally in flowing prose.
- NEVER start your response with your own name, "User:", or anyone else's name followed by a colon. Just speak directly.
- Only output YOUR OWN response. Do not write responses for other participants.
- NEVER use asterisks, markdown formatting, or special characters. Write in plain text only.`;
}

// ── Topic Service ────────────────────────────────────────────
const PRESET_TOPICS = [
  { id: 1, category: "Technology", title: "Should AI replace teachers in schools?", heat: "hot" },
  { id: 2, category: "Society", title: "Is social media doing more harm than good?", heat: "hot" },
  { id: 3, category: "Work", title: "Should remote work be the default?",  heat: "warm" },
  { id: 4, category: "Ethics", title: "Is it ethical to eat meat?", heat: "warm" },
  { id: 5, category: "Technology", title: "Should we colonize Mars or fix Earth first?", heat: "hot" },
  { id: 6, category: "Education", title: "Are university degrees still worth it?", heat: "warm" },
  { id: 7, category: "Finance", title: "Should cryptocurrency be regulated?", heat: "hot" },
  { id: 8, category: "Society", title: "Is cancel culture justified?", heat: "hot" },
  { id: 9, category: "Work", title: "Should the 4-day work week be standard?", heat: "warm" },
  { id: 10, category: "Ethics", title: "Should AI-generated art be copyrighted?", heat: "hot" },
];

// ── Orchestration Service ────────────────────────────────────
function buildConversationMessages(systemPrompt, topic, history, agents) {
  const agentNames = agents.map(a => `${a.name} (${a.mbti})`).join(", ") + ", and a human User";
  
  // Only send last 6 messages
  const recentHistory = history.slice(-6);
  
  // Only include user message if it was within last 3 messages
  const historyForPrompt = recentHistory.map((m, i) => {
    if (m.isUser) {
      const msgAge = recentHistory.length - i;
      if (msgAge > 3) return null; // drop old user messages
      return `USER (human participant): ${m.text}`;
    }
    return `${m.sender}: ${m.text}`;
  }).filter(Boolean);

  const olderCount = history.length - recentHistory.length;
  
  const historyText = history.length === 0
    ? "[No messages yet. You are opening the debate. State your position clearly.]"
    : (olderCount > 0 ? `[${olderCount} earlier messages omitted]\n\n` : "")
      + historyForPrompt.join("\n\n");

  const phase = history.length <= 3 ? "OPENING — State your position clearly and boldly."
    : history.length <= 8 ? "MIDDLE — Introduce new angles. Build on or challenge recent points. Move the discussion into new territory."
    : "CLOSING — Wrap up. Find common ground where natural, or firmly disagree. Give your final position.";

  const msgs = [
    { role: "user", content: `DEBATE TOPIC: "${topic}"
PARTICIPANTS: ${agentNames}

Recent conversation:

${historyText}

DEBATE PHASE: ${phase}

YOUR TURN. Rules:
- 2-4 sentences, natural prose, plain text only
- Respond to the last 1-2 speakers only
- If a User message appears above AND was recent, acknowledge it ONCE briefly then move on
- Never repeat a point already made by anyone — always advance with something NEW
- In CLOSING phase, start reaching conclusions` }
  ];
  return { system: systemPrompt, messages: msgs };
}

// ── Analysis Service ─────────────────────────────────────────
function buildAnalysisPrompt(topic, agents, history) {
  const transcript = history.map(m => `${m.sender} (${m.mbti || "User"}): ${m.text}`).join("\n\n");
  return {
    system: "You are a communication psychology expert specializing in MBTI personality frameworks. Provide insightful, practical analysis. Use natural flowing prose, not bullet points.",
    messages: [{ role: "user", content: `Analyze this debate for personality-driven communication patterns.

TOPIC: "${topic}"
PARTICIPANTS: ${agents.map(a => `${a.name} (${a.mbti} — ${MBTI_DATA[a.mbti].name})`).join(", ")}

TRANSCRIPT:
${transcript}

Provide analysis in this exact JSON format (no markdown, no backticks):
{
  "summary": "2-3 sentence overview of how the debate unfolded",
  "agents": [
    ${agents.map(a => `{
      "name": "${a.name}",
      "mbti": "${a.mbti}",
      "style_observed": "How their MBTI manifested in the debate (2 sentences)",
      "strength": "Their communication strength shown",
      "blindspot": "A potential blindspot in their approach"
    }`).join(",\n    ")}
  ],
  "empathy_tips": [
    "Practical tip 1 for communicating with these personality types in real life",
    "Practical tip 2",
    "Practical tip 3"
  ],
  "key_tension": "The main personality-driven tension in this debate (1 sentence)"
}` }]
  };
}

// ── LLM API Caller (calls backend proxy — never exposes API key) ──
async function callLLM(system, messages) {
  const res = await fetch("/api/llm/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error === "RATE_LIMITED" ? "RATE_LIMITED" : (data.error || "API call failed"));
  }
  return data.text || "...";
}

// ============================================================
// COMPONENTS
// ============================================================

const AGENT_DEFAULTS = [
  { name: "Aria", mbti: "ENTJ" },
  { name: "Kai", mbti: "INFP" },
  { name: "Zhen", mbti: "ISTP" },
];

// ── Setup Screen ─────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const [agents, setAgents] = useState(AGENT_DEFAULTS.map((a,i) => ({ ...a, id: i })));
  const [topic, setTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [catFilter, setCatFilter] = useState("All");

  const updateAgent = (id, field, val) =>
    setAgents(prev => prev.map(a => a.id === id ? { ...a, [field]: val } : a));

  const addAgent = () => {
    if (agents.length >= 5) return;
    const names = ["Aria","Kai","Zhen","Maya","Theo","Luna","Ravi","Noor"];
    const taken = new Set(agents.map(a => a.name));
    const name = names.find(n => !taken.has(n)) || `Agent${agents.length+1}`;
    setAgents(prev => [...prev, { id: Date.now(), name, mbti: "ENTP" }]);
  };

  const removeAgent = (id) => {
    if (agents.length <= 2) return;
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  const finalTopic = selectedPreset ? PRESET_TOPICS.find(t=>t.id===selectedPreset)?.title : customTopic;
  const canStart = agents.length >= 2 && agents.every(a => a.name && a.mbti) && finalTopic;

  const categories = ["All", ...new Set(PRESET_TOPICS.map(t => t.category))];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px", animation: "fadeIn 0.5s ease" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48, padding: "40px 20px", borderRadius: 20, background: "linear-gradient(135deg, rgba(123,94,167,0.08) 0%, rgba(45,155,131,0.06) 100%)", border: "1px solid rgba(123,94,167,0.1)" }}>
        <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: "rgba(123,94,167,0.1)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#7B5EA7", marginBottom: 12, fontWeight: 600 }}>
          PersonaDebate-as-a-Service
        </div>
        <h1 style={{ fontSize: 38, fontWeight: 700, margin: "8px 0 12px", color: "#1a1a1a", lineHeight: 1.2 }}>
          MBTI Persona Debate
        </h1>
        <p style={{ color: "#666", fontSize: 15, maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
          Configure AI agents with different MBTI personalities, pick a topic, and watch how different personality types approach the same issue.
        </p>
      </div>

      {/* Agent Configuration */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>Debate Agents</h2>
          {agents.length < 5 && (
            <button onClick={addAgent} style={{
              background: "none", border: "1px dashed var(--color-border-secondary)", borderRadius: 8,
              padding: "6px 14px", fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer"
            }}>+ Add agent</button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {agents.map((agent) => {
            const { color } = getGroupForType(agent.mbti);
            return (
              <div key={agent.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                borderRadius: 12, border: "1px solid var(--color-border-tertiary)",
                background: "var(--color-background-secondary)"
              }}>
                <div style={{
                  width: 8, height: 40, borderRadius: 4, background: color, flexShrink: 0
                }} />
                <input
                  value={agent.name}
                  onChange={e => updateAgent(agent.id, "name", e.target.value)}
                  placeholder="Agent name"
                  style={{
                    flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 8,
                    border: "1px solid var(--color-border-tertiary)", background: "var(--color-background-primary)",
                    fontSize: 14, color: "var(--color-text-primary)", outline: "none"
                  }}
                />
                <select
                  value={agent.mbti}
                  onChange={e => updateAgent(agent.id, "mbti", e.target.value)}
                  style={{
                    padding: "8px 10px", borderRadius: 8,
                    border: "1px solid var(--color-border-tertiary)", background: "var(--color-background-primary)",
                    fontSize: 14, color: "var(--color-text-primary)", outline: "none", minWidth: 130
                  }}
                >
                  {Object.entries(MBTI_GROUPS).map(([group, { types }]) => (
                    <optgroup key={group} label={group}>
                      {types.map(t => (
                        <option key={t} value={t}>{t} — {MBTI_DATA[t].name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", width: 140, flexShrink: 0 }}>
                  {MBTI_DATA[agent.mbti]?.desc}
                </div>
                {agents.length > 2 && (
                  <button onClick={() => removeAgent(agent.id)} style={{
                    background: "none", border: "none", cursor: "pointer", fontSize: 18,
                    color: "var(--color-text-tertiary)", padding: "4px 8px", lineHeight: 1
                  }}>×</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Topic Selection */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 16px", color: "var(--color-text-primary)" }}>Debate Topic</h2>

        {/* Category filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: catFilter === cat ? "1px solid var(--color-border-primary)" : "1px solid var(--color-border-tertiary)",
              background: catFilter === cat ? "var(--color-background-secondary)" : "transparent",
              color: catFilter === cat ? "var(--color-text-primary)" : "var(--color-text-secondary)"
            }}>{cat}</button>
          ))}
        </div>

        {/* Preset topics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {PRESET_TOPICS.filter(t => catFilter === "All" || t.category === catFilter).map(t => (
            <button key={t.id} onClick={() => { setSelectedPreset(t.id); setCustomTopic(""); }} style={{
              textAlign: "left", padding: "12px 14px", borderRadius: 10, cursor: "pointer",
              border: selectedPreset === t.id ? "2px solid #7B5EA7" : "1px solid var(--color-border-tertiary)",
              background: selectedPreset === t.id ? "rgba(123,94,167,0.08)" : "var(--color-background-primary)",
              color: "var(--color-text-primary)", fontSize: 13, lineHeight: 1.4, transition: "all 0.15s"
            }}>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>
                {t.category} {t.heat === "hot" ? " · trending" : ""}
              </span>
              <br />
              {t.title}
            </button>
          ))}
        </div>

        {/* Custom topic */}
        <div style={{ position: "relative" }}>
          <input
            value={customTopic}
            onChange={e => { setCustomTopic(e.target.value); setSelectedPreset(null); }}
            placeholder="Or type your own debate topic..."
            style={{
              width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10,
              border: "1px solid var(--color-border-tertiary)", background: "var(--color-background-primary)",
              fontSize: 14, color: "var(--color-text-primary)", outline: "none"
            }}
          />
        </div>
      </div>

      {/* Start Button */}
      <button
        disabled={!canStart}
        onClick={() => onStart({ agents, topic: finalTopic })}
        style={{
          width: "100%", padding: "16px 24px", borderRadius: 14, fontSize: 17, fontWeight: 600,
          border: "none", cursor: canStart ? "pointer" : "not-allowed",
          background: canStart ? "linear-gradient(135deg, #7B5EA7 0%, #5A3E8A 100%)" : "#ddd",
          color: canStart ? "#fff" : "#999",
          transition: "all 0.3s", letterSpacing: 0.5,
          boxShadow: canStart ? "0 4px 20px rgba(123,94,167,0.3)" : "none"
        }}
      >
        Start Debate →
      </button>
    </div>
  );
}

// ── Debate Room ──────────────────────────────────────────────
function DebateRoom({ config, onFinish, onBack }) {
  const { agents, topic } = config;
  const [messages, setMessages] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [error, setError] = useState("");
  const [autoMode, setAutoMode] = useState(false);
  const [round, setRound] = useState(1);
  const scrollRef = useRef(null);
  const autoRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const runAgentTurn = useCallback(async () => {
    const agent = agents[currentTurn % agents.length];
    setLoading(true);
    setError("");
    try {
      const sysPrompt = buildSystemPrompt(agent.mbti, agent.name);
      const { system, messages: apiMsgs } = buildConversationMessages(sysPrompt, topic, messages, agents);
      const text = await callLLM(system, apiMsgs);
      const newMsg = { sender: agent.name, mbti: agent.mbti, text, isUser: false, ts: Date.now() };
      setMessages(prev => [...prev, newMsg]);
      const nextTurn = (currentTurn + 1) % agents.length;
      setCurrentTurn(nextTurn);
      if (nextTurn === 0) setRound(r => r + 1);
    } catch (e) {
      if (e.message === "RATE_LIMITED") {
        setError("⏳ Daily API quota reached (20 free requests/day). This is a Google Gemini free-tier limitation. Please wait for the quota to reset or use a new API key.");
      } else {
        setError("API call failed. Check your connection and try again.");
      }
    }
    setLoading(false);
  }, [currentTurn, agents, messages, topic]);

  // Auto mode
  useEffect(() => { autoRef.current = autoMode; }, [autoMode]);
  useEffect(() => {
    if (!autoMode || loading || messages.length >= 20) return;
    const timer = setTimeout(() => {
      if (autoRef.current) runAgentTurn();
    }, 1200);
    return () => clearTimeout(timer);
  }, [autoMode, loading, messages.length, runAgentTurn]);

  const handleUserJoin = () => {
    if (!userInput.trim()) return;
    setMessages(prev => [...prev, { sender: "You", mbti: null, text: userInput.trim(), isUser: true, ts: Date.now() }]);
    setUserInput("");
  };

  const currentAgent = agents[currentTurn % agents.length];
  const { color: currentColor } = getGroupForType(currentAgent.mbti);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", height: "100vh", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <button onClick={onBack} style={{
            background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)", padding: "4px 0"
          }}>← Back to setup</button>
          <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)" }}>
            Round {round} · {messages.length} messages
          </div>
        </div>
        <div style={{
          padding: "16px 20px", borderRadius: 16,
          background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)", backdropFilter: "blur(10px)"
        }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#7B5EA7", marginBottom: 4, fontWeight: 600 }}>Topic</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a" }}>{topic}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {agents.map(a => {
              const { color } = getGroupForType(a.mbti);
              const isNext = a.name === currentAgent.name;
              return (
                <span key={a.id} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", borderRadius: 20, fontSize: 12,
                  background: isNext ? color + "20" : "transparent",
                  border: `1px solid ${isNext ? color : "var(--color-border-tertiary)"}`,
                  color: isNext ? color : "var(--color-text-secondary)",
                  fontWeight: isNext ? 500 : 400
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: color }} />
                  {a.name} · {a.mbti}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 8,
        padding: "8px 0"
      }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--color-text-tertiary)", fontSize: 14 }}>
            Press "Next turn" to begin the debate, or enable auto mode.
          </div>
        )}
        {messages.map((msg, i) => {
          const { color } = msg.isUser ? { color: "#666" } : getGroupForType(msg.mbti);
          return (
            <div key={i} style={{
              display: "flex", gap: 10, alignItems: msg.isUser ? "flex-end" : "flex-start",
              flexDirection: msg.isUser ? "row-reverse" : "row",
              animation: "slideIn 0.4s ease"
            }}>
              {!msg.isUser && (
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${color}20, ${color}35)`,
                  border: `1.5px solid ${color}50`, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color, flexShrink: 0, letterSpacing: 0.5
                }}>
                  {msg.mbti}
                </div>
              )}
              <div style={{
                maxWidth: "80%", padding: "12px 16px", borderRadius: 16,
                background: msg.isUser ? "linear-gradient(135deg, #7B5EA7, #5A3E8A)" : "rgba(255,255,255,0.7)",
                border: msg.isUser ? "none" : "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                backdropFilter: "blur(10px)"
              }}>
                {!msg.isUser && (
                  <div style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 4 }}>
                    {msg.sender} · {MBTI_DATA[msg.mbti]?.name}
                  </div>
                )}
                <div style={{
                  fontSize: 14, lineHeight: 1.6,
                  color: msg.isUser ? "#fff" : "#2a2a2a"
                }}>
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", animation: "slideIn 0.3s ease" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${currentColor}20, ${currentColor}35)`,
              border: `1.5px solid ${currentColor}50`, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: currentColor, flexShrink: 0, letterSpacing: 0.5
            }}>
              {currentAgent.mbti}
            </div>
            <div style={{
              padding: "14px 18px", borderRadius: 16,
              background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
            }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ animation: "pulse 1.2s infinite", fontSize: 13, color: currentColor }}>{currentAgent.name} is thinking</span>
                <span style={{ animation: "pulse 1.2s infinite 0.2s", color: currentColor }}>.</span>
                <span style={{ animation: "pulse 1.2s infinite 0.4s", color: currentColor }}>.</span>
                <span style={{ animation: "pulse 1.2s infinite 0.6s", color: currentColor }}>.</span>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--color-background-danger)", color: "var(--color-text-danger)", fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, padding: "12px 0" }}>
        {/* User input */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleUserJoin()}
            placeholder="Join the debate — type your message..."
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.8)",
              fontSize: 14, color: "#1a1a1a", outline: "none",
              backdropFilter: "blur(10px)"
            }}
          />
          <button onClick={handleUserJoin} disabled={!userInput.trim()} style={{
            padding: "12px 20px", borderRadius: 14, border: "none",
            background: userInput.trim() ? "linear-gradient(135deg, #7B5EA7, #5A3E8A)" : "#ddd",
            color: userInput.trim() ? "#fff" : "#999",
            fontSize: 14, fontWeight: 600, cursor: userInput.trim() ? "pointer" : "not-allowed",
            boxShadow: userInput.trim() ? "0 2px 8px rgba(123,94,167,0.25)" : "none"
          }}>Send</button>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={runAgentTurn}
            disabled={loading || autoMode}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 14, fontSize: 14, fontWeight: 600,
              border: `2px solid ${currentColor}`, cursor: loading || autoMode ? "not-allowed" : "pointer",
              background: loading || autoMode ? "transparent" : `linear-gradient(135deg, ${currentColor}10, ${currentColor}05)`,
              color: currentColor,
              opacity: loading || autoMode ? 0.4 : 1, transition: "all 0.2s"
            }}
          >
            Next turn: {currentAgent.name} ({currentAgent.mbti})
          </button>

          <button onClick={() => setAutoMode(!autoMode)} style={{
            padding: "12px 16px", borderRadius: 14, fontSize: 13, fontWeight: 600,
            border: autoMode ? "2px solid #2D9B83" : "1px solid rgba(0,0,0,0.12)",
            background: autoMode ? "rgba(45,155,131,0.1)" : "rgba(255,255,255,0.5)",
            color: autoMode ? "#2D9B83" : "#666", cursor: "pointer"
          }}>
            {autoMode ? "■ Stop" : "▶ Auto"}
          </button>

          {messages.length >= 4 && (
            <button onClick={() => { setAutoMode(false); onFinish(messages); }} style={{
              padding: "12px 16px", borderRadius: 14, fontSize: 13, fontWeight: 600,
              border: "none", background: "linear-gradient(135deg, #2D9B83, #1E7A64)",
              color: "#fff", cursor: "pointer",
              boxShadow: "0 2px 8px rgba(45,155,131,0.25)"
            }}>
              Analyze →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Analysis Screen ──────────────────────────────────────────
function AnalysisScreen({ config, messages, onBack }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { system, messages: apiMsgs } = buildAnalysisPrompt(config.topic, config.agents, messages);
        const raw = await callLLM(system, apiMsgs);
        const clean = raw.replace(/```json|```/g, "").trim();
        setAnalysis(JSON.parse(clean));
      } catch (e) {
        setError("Analysis failed. The debate may have been too short for meaningful analysis.");
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "80px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 15, color: "var(--color-text-secondary)", marginBottom: 8 }}>Analyzing communication patterns...</div>
        <div style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Our analysis service is reviewing {messages.length} messages across {config.agents.length} personality types</div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "80px 16px", textAlign: "center" }}>
        <div style={{ color: "var(--color-text-danger)", marginBottom: 16 }}>{error}</div>
        <button onClick={onBack} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>← Back to debate</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
      <button onClick={onBack} style={{
        background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)", padding: "4px 0", marginBottom: 16
      }}>← Back to debate</button>

      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
          Post-Debate Analysis
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 500, margin: "0 0 10px", color: "var(--color-text-primary)" }}>Communication Insights</h2>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6, maxWidth: 500, margin: "0 auto" }}>
          {analysis.summary}
        </p>
      </div>

      {/* Key Tension */}
      {analysis.key_tension && (
        <div style={{
          padding: "14px 18px", borderRadius: 12, marginBottom: 24,
          background: "rgba(123,94,167,0.06)", borderLeft: "3px solid #7B5EA7"
        }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: "#7B5EA7", marginBottom: 4 }}>Key tension</div>
          <div style={{ fontSize: 14, color: "var(--color-text-primary)", lineHeight: 1.5 }}>{analysis.key_tension}</div>
        </div>
      )}

      {/* Agent Analysis Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        {analysis.agents?.map((a, i) => {
          const { color } = getGroupForType(a.mbti);
          return (
            <div key={i} style={{
              padding: "16px 18px", borderRadius: 12,
              border: "1px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", borderRadius: 20, fontSize: 12,
                  background: color + "18", border: `1px solid ${color}40`, color, fontWeight: 500
                }}>
                  {a.mbti} · {MBTI_DATA[a.mbti]?.name}
                </span>
                <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>{a.name}</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--color-text-primary)", margin: "0 0 10px" }}>
                {a.style_observed}
              </p>
              <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                <div>
                  <span style={{ color: "var(--color-text-success)", fontWeight: 500 }}>Strength: </span>
                  <span style={{ color: "var(--color-text-secondary)" }}>{a.strength}</span>
                </div>
                <div>
                  <span style={{ color: "var(--color-text-warning)", fontWeight: 500 }}>Blindspot: </span>
                  <span style={{ color: "var(--color-text-secondary)" }}>{a.blindspot}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empathy Tips */}
      <div style={{
        padding: "18px 20px", borderRadius: 14,
        background: "rgba(45,155,131,0.06)", border: "1px solid rgba(45,155,131,0.15)"
      }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: "#2D9B83", marginBottom: 12 }}>
          Empathy tips for real life
        </div>
        {analysis.empathy_tips?.map((tip, i) => (
          <div key={i} style={{
            fontSize: 14, lineHeight: 1.55, color: "var(--color-text-primary)",
            padding: "8px 0", borderTop: i > 0 ? "1px solid rgba(45,155,131,0.1)" : "none"
          }}>
            <span style={{ color: "#2D9B83", fontWeight: 500, marginRight: 8 }}>{i + 1}.</span>
            {tip}
          </div>
        ))}
      </div>

      {/* Debate Stats */}
      <div style={{
        marginTop: 24, padding: "14px 18px", borderRadius: 12,
        background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)",
        display: "flex", justifyContent: "space-around", textAlign: "center", fontSize: 13
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)" }}>{messages.length}</div>
          <div style={{ color: "var(--color-text-tertiary)" }}>Messages</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)" }}>{config.agents.length}</div>
          <div style={{ color: "var(--color-text-tertiary)" }}>Agents</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)" }}>{messages.filter(m=>m.isUser).length}</div>
          <div style={{ color: "var(--color-text-tertiary)" }}>Your inputs</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)" }}>{new Set(config.agents.map(a=>a.mbti)).size}</div>
          <div style={{ color: "var(--color-text-tertiary)" }}>MBTI types</div>
        </div>
      </div>
    </div>
  );
}

// ── App Root ─────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("setup"); // setup | debate | analysis
  const [config, setConfig] = useState(null);
  const [debateMessages, setDebateMessages] = useState([]);

  const handleStart = (cfg) => {
    setConfig(cfg);
    setDebateMessages([]);
    setScreen("debate");
  };

  const handleFinish = (msgs) => {
    setDebateMessages(msgs);
    setScreen("analysis");
  };

  if (screen === "setup") return <SetupScreen onStart={handleStart} />;
  if (screen === "debate") return <DebateRoom config={config} onFinish={handleFinish} onBack={() => setScreen("setup")} />;
  if (screen === "analysis") return <AnalysisScreen config={config} messages={debateMessages} onBack={() => setScreen("debate")} />;
}
