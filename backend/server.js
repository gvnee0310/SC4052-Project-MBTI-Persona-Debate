require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ── Config ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ── Gemini API helper ────────────────────────────────────────
async function callGemini(systemPrompt, userMessage) {
  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 2048,
    },
  };

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 429) {
        throw new Error("RATE_LIMITED");
      }
      if (response.status === 429) {
        throw new Error("RATE_LIMITED");
      }
      if (response.status === 429) {
        throw new Error("RATE_LIMITED");
      }
      throw new Error(`Gemini API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  return text;
}

// ── In-memory session store (replace with Redis/DB in production) ──
const sessions = new Map();

// ============================================================
// SERVICE 1: Personality Service — /api/personality
// ============================================================

const mbtiData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "mbti-profiles.json"), "utf-8")
);

app.get("/api/personality/types", (req, res) => {
  const types = Object.entries(mbtiData).map(([code, data]) => ({
    code, name: data.name, description: data.desc, group: data.group,
  }));
  res.json({ types, total: types.length });
});

app.get("/api/personality/types/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  const profile = mbtiData[code];
  if (!profile) return res.status(404).json({ error: "MBTI type not found" });
  res.json({ code, ...profile });
});

app.post("/api/personality/configure", (req, res) => {
  const { agents } = req.body;
  if (!agents || !Array.isArray(agents) || agents.length < 2) {
    return res.status(400).json({ error: "At least 2 agents required" });
  }
  const configured = agents.map((agent) => {
    const profile = mbtiData[agent.mbti];
    if (!profile) return { ...agent, error: `Unknown MBTI type: ${agent.mbti}` };
    return {
      name: agent.name, mbti: agent.mbti,
      systemPrompt: buildSystemPrompt(agent.mbti, agent.name, profile),
    };
  });
  res.json({ agents: configured });
});

function buildSystemPrompt(mbtiType, agentName, profile) {
  return `You are ${agentName}, a debate participant with the MBTI personality type ${mbtiType} (${profile.name}).

PERSONALITY AND DEBATE STYLE:
${profile.style}

RULES:
- Stay in character as a ${mbtiType} throughout.
- Keep responses concise (2-4 sentences per turn).
- Respond directly to what others have said. Reference their points by name.
- Show your personality through your communication style, word choice, and reasoning.
- Never mention that you are an AI. You are roleplaying as a person with this MBTI type.
- Do not use bullet points or numbered lists. Speak naturally.
- NEVER start your response with your own name, "User:", or anyone else's name followed by a colon. Just speak directly.
- Only output YOUR OWN response. Do not write responses for other participants.`;
}

// ============================================================
// SERVICE 2: Topic Service — /api/topics
// ============================================================

const presetTopics = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "topics.json"), "utf-8")
);

app.get("/api/topics/presets", (req, res) => {
  const { category } = req.query;
  let topics = presetTopics;
  if (category) {
    topics = topics.filter((t) => t.category.toLowerCase() === category.toLowerCase());
  }
  res.json({ topics, total: topics.length });
});

app.get("/api/topics/trending", async (req, res) => {
  try {
    const response = await fetch("https://mastodon.social/api/v1/trends/statuses?limit=10");
    const statuses = await response.json();
    const trending = statuses.map((status) => ({
      id: status.id,
      content: status.content.replace(/<[^>]*>/g, "").substring(0, 200),
      author: status.account?.display_name || "Unknown",
      url: status.url,
      reblogs: status.reblogs_count,
      favourites: status.favourites_count,
    }));
    res.json({ source: "mastodon", topics: trending });
  } catch (error) {
    res.status(502).json({ error: "Failed to fetch trending topics", fallback: presetTopics.slice(0, 5) });
  }
});

app.get("/api/topics/news", async (req, res) => {
  try {
    const newsApiKey = process.env.NEWS_API_KEY;
    if (!newsApiKey) {
      return res.json({ source: "preset", topics: presetTopics.filter((t) => t.heat === "hot"), note: "Set NEWS_API_KEY for live news" });
    }
    const response = await fetch(`https://newsapi.org/v2/top-headlines?country=us&category=technology&apiKey=${newsApiKey}`);
    const data = await response.json();
    const topics = data.articles?.slice(0, 8).map((a) => ({ title: a.title, description: a.description, source: a.source?.name, url: a.url }));
    res.json({ source: "newsapi", topics });
  } catch (error) {
    res.status(502).json({ error: "Failed to fetch news" });
  }
});

app.post("/api/topics/custom", (req, res) => {
  const { title, category } = req.body;
  if (!title) return res.status(400).json({ error: "Topic title required" });
  res.json({ topic: { id: `custom_${Date.now()}`, title, category: category || "Custom", heat: "custom", createdAt: new Date().toISOString() } });
});

// ============================================================
// SERVICE 3: Debate Orchestration Service — /api/debate
// ============================================================

app.post("/api/debate/start", (req, res) => {
  const { agents, topic } = req.body;
  if (!agents || !topic) return res.status(400).json({ error: "agents and topic required" });

  const sessionId = `debate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const session = {
    id: sessionId, topic,
    agents: agents.map((a) => ({ ...a, systemPrompt: buildSystemPrompt(a.mbti, a.name, mbtiData[a.mbti]) })),
    messages: [], currentTurn: 0, round: 1, status: "active", createdAt: new Date().toISOString(),
  };
  sessions.set(sessionId, session);
  res.json({ sessionId, topic, agents: agents.map((a) => ({ name: a.name, mbti: a.mbti })), status: "active" });
});

app.post("/api/debate/:sessionId/next-turn", async (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.status !== "active") return res.status(400).json({ error: "Debate is not active" });

  const agent = session.agents[session.currentTurn % session.agents.length];
  const agentNames = session.agents.map((a) => `${a.name} (${a.mbti})`).join(", ");
  const historyText = session.messages.length === 0
    ? "[No messages yet. You are opening the debate. State your position clearly.]"
    : session.messages.map((m) => `${m.sender}: ${m.text}`).join("\n\n");

  try {
    const text = await callGemini(
      agent.systemPrompt,
      `DEBATE TOPIC: "${session.topic}"\nPARTICIPANTS: ${agentNames}\n\nConversation so far:\n\n${historyText}\n\nNow it is YOUR turn. Respond in character. 2-4 sentences, natural prose.`
    );

    const message = { sender: agent.name, mbti: agent.mbti, text, isUser: false, timestamp: new Date().toISOString() };
    session.messages.push(message);
    session.currentTurn = (session.currentTurn + 1) % session.agents.length;
    if (session.currentTurn === 0) session.round++;

    res.json({ message, nextAgent: session.agents[session.currentTurn % session.agents.length], round: session.round, totalMessages: session.messages.length });
  } catch (error) {
    res.status(500).json({ error: "LLM API call failed", details: error.message });
  }
});

app.post("/api/debate/:sessionId/user-message", (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Message text required" });

  const message = { sender: "User", mbti: null, text, isUser: true, timestamp: new Date().toISOString() };
  session.messages.push(message);
  res.json({ message, nextAgent: session.agents[session.currentTurn % session.agents.length], totalMessages: session.messages.length });
});

app.get("/api/debate/:sessionId", (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json({ id: session.id, topic: session.topic, agents: session.agents.map((a) => ({ name: a.name, mbti: a.mbti })), messages: session.messages, currentTurn: session.currentTurn, round: session.round, status: session.status });
});

app.post("/api/debate/:sessionId/end", (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  session.status = "completed";
  res.json({ id: session.id, status: "completed", totalMessages: session.messages.length, totalRounds: session.round });
});

// ============================================================
// SERVICE 4: Analysis Service — /api/analysis
// ============================================================

app.post("/api/analysis/summarize", async (req, res) => {
  const { sessionId } = req.body;
  let session, agents, messages, topic;

  if (sessionId) {
    session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    agents = session.agents; messages = session.messages; topic = session.topic;
  } else {
    agents = req.body.agents; messages = req.body.messages; topic = req.body.topic;
  }

  if (!messages || messages.length < 4) {
    return res.status(400).json({ error: "At least 4 messages required for analysis" });
  }

  const transcript = messages.map((m) => `${m.sender} (${m.mbti || "User"}): ${m.text}`).join("\n\n");

  try {
    const raw = await callGemini(
      "You are a communication psychology expert specializing in MBTI personality frameworks. Respond ONLY with valid JSON. No markdown, no backticks, no extra text before or after the JSON.",
      `Analyze this debate for personality-driven communication patterns.

TOPIC: "${topic}"
PARTICIPANTS: ${agents.map((a) => `${a.name} (${a.mbti} — ${mbtiData[a.mbti]?.name || a.mbti})`).join(", ")}

TRANSCRIPT:
${transcript}

Respond with ONLY this JSON:
{
  "summary": "2-3 sentence overview",
  "agents": [${agents.map((a) => `{"name":"${a.name}","mbti":"${a.mbti}","style_observed":"...","strength":"...","blindspot":"..."}`).join(",")}],
  "empathy_tips": ["tip1","tip2","tip3"],
  "key_tension": "main personality-driven tension (1 sentence)"
}`
    );

    // Extract JSON more robustly — find content between first { and last }
    let clean = raw.replace(/```json|```/g, "").trim();
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }
    let analysis;
    try {
      analysis = JSON.parse(clean);
    } catch (parseErr) {
      console.error("JSON parse failed. Raw response:", raw);
      throw new Error("Analysis response was not valid JSON. Try running the debate longer before analyzing.");
    }
    if (session) session.status = "analyzed";

    res.json({ analysis, debateStats: { messages: messages.length, agents: agents.length, rounds: session?.round || 0 } });
  } catch (error) {
    res.status(500).json({ error: "Analysis failed", details: error.message });
  }
});

// ============================================================
// Health check + LLM Proxy + Start
// ============================================================

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "PDaaS API", version: "1.0.0", llmProvider: "Google Gemini 2.5 Flash (free tier)", activeSessions: sessions.size, timestamp: new Date().toISOString() });
});

// Frontend calls this proxy — never exposes API key to browser
app.post("/api/llm/chat", async (req, res) => {
  const { system, messages } = req.body;
  try {
    const userMsg = messages?.filter((m) => m.role === "user").map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n\n") || "";
    const text = await callGemini(system || "", userMsg);
    res.json({ text });
  } catch (error) {
    console.error("LLM ERROR:", error.message);
    if (error.message === "RATE_LIMITED") {
      res.status(429).json({ error: "RATE_LIMITED", message: "Daily API quota reached (20 free requests/day)." });
    } else {
      if (error.message === "RATE_LIMITED") {
      res.status(429).json({ error: "RATE_LIMITED" });
    } else {
      if (error.message === "RATE_LIMITED") {
      res.status(429).json({ error: "RATE_LIMITED" });
    } else {
      res.status(500).json({ error: error.message });
    }
    }
    }
  }
});

app.use(express.static(path.join(__dirname, "..", "frontend", "dist")));

app.listen(PORT, () => {
  console.log(`PDaaS API server running on port ${PORT}`);
  console.log(`LLM: Google Gemini 2.5 Flash (free tier)`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
