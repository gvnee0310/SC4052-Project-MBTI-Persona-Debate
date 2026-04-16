# PDaaS — PersonaDebate-as-a-Service

**SC4053 Cloud Computing — Topic 8: X-as-a-Service**

A cloud-native SaaS platform that uses multi-agent AI debates to help users understand how different MBTI personality types approach communication, fostering real-world empathy and interpersonal skills.

---

## 1. Project Overview

### The Problem
People often struggle to understand why others communicate, argue, and make decisions differently. Misunderstandings rooted in personality differences cause friction in workplaces, relationships, and public discourse.

### The Solution
PDaaS deploys multiple AI agents — each role-playing a distinct MBTI personality type — in structured debates on user-chosen topics. Users observe (and join) these debates, then receive AI-generated analysis of how each personality type approached the discussion, along with actionable empathy tips for real-life interactions.

### Dual-Utility Design

1. **User Utility**: Individuals gain practical communication skills by observing personality-driven debate patterns and receiving tailored empathy tips.
2. **Research Utility**: The platform generates structured data on how MBTI-framed AI agents reason differently about the same topic — useful for communication psychology research and AI behavior studies.

---

## 2. Architecture

### Service-Oriented Architecture

The system decomposes PA capabilities into **4 independent microservices** communicating via RESTful API calls:

```
┌─────────────────────────────────┐
│         React Frontend          │
│    (Debate UI, Topic Browser)   │
└──────────────┬──────────────────┘
               │ REST API calls
┌──────────────▼──────────────────┐
│    API Gateway (Express.js)     │
│         /api/*  routes          │
└──┬───────┬────────┬─────────┬───┘
   │       │        │         │
┌──▼──┐ ┌──▼──┐  ┌──▼──┐  ┌──▼──┐
│Pers.│ │Orch.│  │Topic│  │Anal.│
│ Svc │ │ Svc │  │ Svc │  │ Svc │
└──┬──┘ └──┬──┘  └──┬──┘  └──┬──┘
   │       │        │         │
   ▼       ▼        ▼         ▼
 MBTI    Claude   Mastodon  Claude
 Data     API    /News API    API
```

### Service Descriptions

| Service | Base Path | Responsibility |
|---------|-----------|---------------|
| **Personality Service** | `/api/personality` | Manages 16 MBTI profiles, generates agent system prompts |
| **Orchestration Service** | `/api/debate` | Session management, turn-taking logic, LLM API calls |
| **Topic Service** | `/api/topics` | Curated topics, Mastodon API integration, NewsAPI integration |
| **Analysis Service** | `/api/analysis` | Post-debate insight generation via LLM |

### Why This Decomposition?

- **Single Responsibility**: Each service has one clear job. The Personality Service knows nothing about debates; the Topic Service knows nothing about MBTI.
- **Independent Scaling**: The Orchestration Service (which makes LLM API calls) is the bottleneck — it can scale horizontally behind a load balancer without touching the other services.
- **Loose Coupling**: Services communicate via well-defined JSON over REST. Replacing the LLM provider (e.g., switching from Claude to GPT) only requires changing the Orchestration Service.
- **Stateless Design**: Each service is stateless per-request (session state is externalized), enabling elastic cloud deployment.

---

## 3. RESTful API Specification

### 3.1 Personality Service

#### `GET /api/personality/types`
Returns all 16 MBTI types with descriptions.

**Response:**
```json
{
  "types": [
    { "code": "INTJ", "name": "Architect", "description": "Strategic, independent, determined", "group": "Analysts" }
  ],
  "total": 16
}
```

#### `GET /api/personality/types/:code`
Returns detailed profile for a specific MBTI type.

#### `POST /api/personality/configure`
Configures agents with MBTI types and generates system prompts.

**Request:**
```json
{
  "agents": [
    { "name": "Aria", "mbti": "ENTJ" },
    { "name": "Kai", "mbti": "INFP" }
  ]
}
```

**Response:**
```json
{
  "agents": [
    { "name": "Aria", "mbti": "ENTJ", "systemPrompt": "You are Aria, a debate participant..." }
  ]
}
```

### 3.2 Topic Service

#### `GET /api/topics/presets`
Returns curated debate topics. Optional `?category=Technology` filter.

#### `GET /api/topics/trending`
Fetches trending content from Mastodon public timeline API.

**External API Integration:**
```
GET https://mastodon.social/api/v1/trends/statuses?limit=10
```

#### `GET /api/topics/news`
Fetches news headlines from NewsAPI for debate topic suggestions.

#### `POST /api/topics/custom`
Allows users to submit custom debate topics.

### 3.3 Debate Orchestration Service

#### `POST /api/debate/start`
Creates a new debate session.

**Request:**
```json
{
  "agents": [{ "name": "Aria", "mbti": "ENTJ" }, { "name": "Kai", "mbti": "INFP" }],
  "topic": "Should AI replace teachers in schools?"
}
```

**Response:**
```json
{
  "sessionId": "debate_1712345678_abc123",
  "topic": "Should AI replace teachers in schools?",
  "agents": [{ "name": "Aria", "mbti": "ENTJ" }, { "name": "Kai", "mbti": "INFP" }],
  "status": "active"
}
```

#### `POST /api/debate/:sessionId/next-turn`
Triggers the next agent's turn. The service:
1. Retrieves the current agent from the turn queue
2. Builds a conversation context from message history
3. Calls the Gemini API with the agent's MBTI system prompt
4. Returns the agent's response and advances the turn

#### `POST /api/debate/:sessionId/user-message`
Injects the user's message into the debate conversation.

#### `GET /api/debate/:sessionId`
Returns full session state (messages, turn info, status).

#### `POST /api/debate/:sessionId/end`
Marks the session as completed.

### 3.4 Analysis Service

#### `POST /api/analysis/summarize`
Generates post-debate analysis using LLM.

**Request:**
```json
{ "sessionId": "debate_1712345678_abc123" }
```

**Response:**
```json
{
  "analysis": {
    "summary": "The debate revealed a clear tension between ENTJ's results-driven approach and INFP's values-based reasoning...",
    "agents": [
      {
        "name": "Aria",
        "mbti": "ENTJ",
        "style_observed": "Aria dominated the discussion with confident assertions...",
        "strength": "Clear, decisive communication",
        "blindspot": "May dismiss emotional concerns as irrelevant"
      }
    ],
    "empathy_tips": [
      "When speaking with an ENTJ, lead with outcomes and data before sharing feelings",
      "Give INFPs space to express their values — don't rush them to a conclusion"
    ],
    "key_tension": "The fundamental clash between efficiency-first and people-first worldviews"
  }
}
```

---

## 4. External API Integrations

| API | Service | Purpose | Endpoint Used |
|-----|---------|---------|--------------|
| **Google Gemini API** | Orchestration, Analysis | Agent reasoning, debate responses, insight generation | `POST /v1beta/models/gemini-2.5-flash:generateContent` |
| **Mastodon API** | Topic Service | Fetch trending social content for debate topics | `GET /api/v1/trends/statuses` |
| **NewsAPI** | Topic Service | Fetch current news headlines as debate topics | `GET /v2/top-headlines` |

---

## 5. Scalability Discussion

### Horizontal Scaling
- **Orchestration Service** is the primary bottleneck (LLM API calls). Being stateless per-request, it can run behind a load balancer with N instances. Session state is externalized to a shared store (Redis in production).
- **Topic Service** responses are cacheable (trending topics update hourly), reducing external API calls via CDN/edge caching.
- **Personality Service** is purely data-serving — easily replicated and cached at the edge.

### Elastic Cloud Resources
- Auto-scaling groups can spin up Orchestration Service instances during peak usage (e.g., classroom hours for EdTech use case).
- The LLM API calls are the true scaling constraint — rate limiting and request queuing ensure graceful degradation.

### Deployment Architecture (Production)
```
Users → CloudFlare CDN (static frontend)
      → AWS ALB → ECS Fargate (API services, auto-scaled)
      → ElastiCache Redis (session store)
      → CloudWatch (monitoring + auto-scale triggers)
```

---

## 6. Setup & Running

Clone the repository and navigate to the backend folder.  

2. Run npm install to install dependencies.  

3. Create a .env file with your free Gemini API key from https://aistudio.google.com/apikey.  

4. Run npm start to launch the backend on port 3001.  

5. In a separate terminal, navigate to the frontend folder and run npm install followed by npm run dev.  

6. Open http://localhost:5173 in your browser. 

---

## 7. Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Frontend | React (JSX) | Component-based UI, wide ecosystem |
| API Server | Express.js | Lightweight, RESTful routing |
| LLM | Google Gemini 2.5 Flash (free) | Free tier, strong instruction-following for roleplay |
| External APIs | Mastodon, NewsAPI | Real-time topic sourcing |
| Data Store | JSON files / SQLite | Simple, sufficient for prototype |
| Deployment | Vercel + Railway/Render | Free tier cloud hosting |

---

## 8. Mapping to Topic 8 Requirements

| Requirement | How PDaaS Addresses It |
|-------------|----------------------|
| Identify a high-value "X" | Persona-driven debate — understanding diverse perspectives is hard to practise alone |
| Architect as cloud service | 4 RESTful microservices, stateless, independently scalable |
| Dual-utility design | User empathy training + research data on personality-driven AI reasoning |
| AI-powered solution | Multi-agent LLM debates with MBTI personality prompting |
| Demonstrate novel API use | Mastodon trending API → debate topics; Gemini API → agent personalities |
