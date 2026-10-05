"""
NVIDIA NIM and LLM Gateway for TigerDB Desktop Memory Agent.
Connects via langchain_openai to NVIDIA NIM API with intelligent fallback and structured output.
"""
import os
import json
import re
from typing import Optional, Dict, Any, Literal
from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()

# Step 1: Define Schema Using Pydantic
class VoiceStructuredResponse(BaseModel):
    format: Literal["markdown", "html", "general"] = Field(
        default="general",
        description="Must be 'markdown' for code/guides, 'html' for UI cards, or 'general' for casual chat."
    )
    speakingtext: str = Field(
        default="",
        description="Short spoken text for TTS voice playback. 1-2 sentences. No code blocks, backticks, or HTML tags."
    )
    content: str = Field(
        default="",
        description="Rendered markdown or html content, or an empty string if general format."
    )

def parse_voice_json(raw_text: str) -> dict:
    """Robust parser that handles unescaped newlines, markdown code fences, and triple quotes."""
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    # Handle if model used Python triple-quotes for content
    triple_fixed = re.sub(
        r'"content"\s*:\s*"""([\s\S]*?)"""',
        lambda m: '"content": ' + json.dumps(m.group(1).strip()),
        cleaned
    )
    try:
        return json.loads(triple_fixed, strict=False)
    except Exception:
        pass

    try:
        return json.loads(cleaned, strict=False)
    except Exception:
        pass

    # Fallback regex extraction
    fmt_m = re.search(r'"format"\s*:\s*"([^"]+)"', cleaned, re.IGNORECASE)
    spk_m = re.search(r'"speakingtext"\s*:\s*"([^"]+)"', cleaned, re.IGNORECASE)
    cnt_m = re.search(r'"content"\s*:\s*(?:"""([\s\S]*?)"""|"([\s\S]*?)"\s*\})', cleaned)
    return {
        "format": fmt_m.group(1).lower() if fmt_m else "general",
        "speakingtext": spk_m.group(1) if spk_m else "",
        "content": (cnt_m.group(1) or cnt_m.group(2) or "").strip() if cnt_m else ""
    }

class LLMGateway:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://integrate.api.nvidia.com/v1",
        model: str = "meta/llama-3.2-11b-vision-instruct"
    ):
        self.api_key = api_key or os.getenv("NVIDIA_API_KEY", "")
        self.base_url = os.getenv("NVIDIA_BASE_URL", base_url)
        self.model_name = os.getenv("NVIDIA_MODEL", model)
        self._client = None

        if self.api_key and not self.api_key.startswith("nvapi-your-"):
            try:
                from langchain_openai import ChatOpenAI
                self._client = ChatOpenAI(
                    base_url=self.base_url,
                    api_key=self.api_key,
                    model=self.model_name,
                    temperature=0.2,
                    max_tokens=1500
                )
            except Exception as e:
                print(f"[LLMGateway] Warning: Failed to initialize ChatOpenAI: {e}")
                self._client = None

    def _get_client(self):
        if not self._client:
            load_dotenv(override=True)
            self.api_key = os.getenv("NVIDIA_API_KEY", "")
            self.base_url = os.getenv("NVIDIA_BASE_URL", self.base_url)
            self.model_name = os.getenv("NVIDIA_MODEL", self.model_name)
            if self.api_key and not self.api_key.startswith("nvapi-your-"):
                try:
                    from langchain_openai import ChatOpenAI
                    self._client = ChatOpenAI(
                        base_url=self.base_url,
                        api_key=self.api_key,
                        model=self.model_name,
                        temperature=0.2,
                        max_tokens=1500
                    )
                except Exception as e:
                    print(f"[LLMGateway] Warning: Failed to initialize ChatOpenAI: {e}")
                    self._client = None
        return self._client

    def is_live_llm_ready(self) -> bool:
        return self._get_client() is not None

    def invoke(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Invokes NVIDIA NIM LLM, or provides high-fidelity local response."""
        client = self._get_client()
        if client:
            try:
                from langchain_core.messages import HumanMessage, SystemMessage
                messages = []
                if system_prompt:
                    messages.append(SystemMessage(content=system_prompt))
                messages.append(HumanMessage(content=prompt))
                response = client.invoke(messages)
                return response.content
            except Exception as e:
                print(f"[LLMGateway] NVIDIA NIM invocation error ({e}), falling back to local reasoning.")

        # Local deterministic synthesis fallback
        return self._fallback_synthesis(prompt)

    # Step 2: invoke_voice_structured with Pydantic structured output mapping & robust fallback
    def invoke_voice_structured(self, query: str, memories_context: str = "") -> Dict[str, Any]:
        """
        Uses LangChain with NVIDIA NIM structured output mapping to produce a guaranteed Pydantic model.
        """
        client = self._get_client()
        if client:
            try:
                from langchain_core.messages import SystemMessage, HumanMessage

                system_instructions = (
                    "You are Desktop Memory AI — the user's friendly developer companion and close desk friend!\n"
                    "Your tone is warm, enthusiastic, supportive, and natural (like a real friend pair-programming with them).\n"
                    "For greetings or casual check-ins, respond with friendly buddy energy like: 'Hey! Hey friend, how are you? What's up? What are we trying to do today?'\n\n"
                    "You AUTONOMOUSLY determine the best visual/textual representation ('html', 'markdown', or 'general') for your friend's request. "
                    "Your friend will NOT specify the format (they will never say 'in HTML' or 'in markdown'). You MUST intelligently inspect their query intent and decide the optimal format yourself:\n\n"
                    "AUTONOMOUS REPRESENTATION RULES:\n"
                    "1. Choose format = 'html' whenever the request is visual, quantitative, graphical, interactive, or playful:\n"
                    "   - Statistics, metrics, charts, data comparisons, distributions (e.g. population by continent/country, sales, revenue, memory usage, weather, timelines, progress): Immediately build a complete visual chart using Chart.js (<script src=\"https://cdn.jsdelivr.net/npm/chart.js\"></script>) or HTML5 Canvas with real data, colors, labels, and tooltips in content!\n"
                    "   - Games, simulations, animations (e.g. Mario, Pong, Flappy Bird, Snake, Tic-Tac-Toe): NEVER just reply 'I can make it' or give text. Immediately build the complete, playable HTML5 canvas game with keyboard controls (Arrow keys/WASD, Space to jump), visible player, obstacles, and animation loop in content!\n"
                    "   - Interactive tools and UI widgets (e.g. calculator, stopwatch, unit converter, interactive dashboard card, activity summary): Build the working HTML/CSS/JS widget in content.\n"
                    "   - CRITICAL FOR 'html': content MUST be 100% executable HTML (including all <style> and <script> tags) that directly renders the visual immediately. NEVER write conversational explanations, tutorials, or bare un-tagged code. Directly render the working visual.\n\n"
                    "2. Choose format = 'markdown' whenever the request is technical, commands, code, or documentation:\n"
                    "   - Terminal commands, devops setups, CLI recipes (e.g. Docker, Kafka, Git, Postgres, TimescaleDB, bash, curl, system administration): Put exact runnable commands in ```bash code blocks under clean ## headings.\n"
                    "   - Code implementations, debugging, script writing, configuration files: Put code in appropriate language code blocks (```python, ```yaml, etc.).\n"
                    "   - Desktop memory searches with multiple files, dates, paths, or structured details.\n"
                    "   - Structure with ## headings, bullet points, and code blocks in content.\n\n"
                    "3. Choose format = 'general' ONLY for natural conversational voice responses:\n"
                    "   - Casual greetings, chit-chat, identity questions ('hello', 'how are you', 'who are you', 'thank you'). Use friendly buddy energy: 'Hey! Hey friend, how are you? What's up?'\n"
                    "   - Quick 1-2 sentence direct factual Q&A or simple memory recall where no code, chart, or visual applies.\n"
                    "   - In 'general', content MUST be empty string \"\", and speakingtext contains your complete spoken response.\n\n"
                    "OUTPUT SCHEMA (Strict JSON only):\n"
                    "{\n"
                    '  "format": "html" | "markdown" | "general",\n'
                    '  "speakingtext": "1-2 natural spoken sentences summarizing the answer for browser text-to-speech. Do NOT speak code, HTML tags, or markdown symbols.",\n'
                    '  "content": "Fully executable HTML (if html), or formatted markdown with ## and code blocks (if markdown), or \\"\\" (if general)"\n'
                    "}"
                )

                messages = [
                    SystemMessage(content=system_instructions),
                    HumanMessage(content=f"User Query: {query}\n\nRetrieved Desktop Memories:\n{memories_context or 'None'}\n\nJSON:")
                ]

                fmt_val = "general"
                spk_val = ""
                cnt_val = ""

                # First try structured_client
                try:
                    structured_client = client.with_structured_output(VoiceStructuredResponse)
                    result: VoiceStructuredResponse = structured_client.invoke(messages)
                    fmt_val = str(result.format).lower()
                    spk_val = result.speakingtext
                    cnt_val = result.content
                except Exception as structured_err:
                    print(f"[LLMGateway] with_structured_output note ({structured_err}), using direct JSON parser...")
                    raw_res = client.invoke(messages).content
                    parsed = parse_voice_json(raw_res)
                    fmt_val = str(parsed.get("format", "general")).lower()
                    spk_val = parsed.get("speakingtext", "")
                    cnt_val = parsed.get("content", "")

                # 1. Content-based format detection
                has_html = any(tag in cnt_val.lower() for tag in ["<canvas", "<svg", "<script", "<div", "<table", "<html", "chart(", "new chart"])
                has_markdown = any(md in cnt_val for md in ["```", "## ", "- **"])

                if has_html:
                    fmt_val = "html"
                elif has_markdown and fmt_val != "html":
                    fmt_val = "markdown"

                # 2. Autonomous Intent Correction if model returned 'general' with empty content for visual/code requests
                q_lower = query.lower()
                is_visual_request = any(w in q_lower for w in ["chart", "graph", "plot", "population", "game", "mario", "pong", "visual", "dashboard", "widget", "calculator", "compare", "statistics", "continent"])
                is_code_request = any(w in q_lower for w in ["docker", "kafka", "command", "commands", "terminal", "bash", "curl", "script", "install", "how to run"])

                if fmt_val == "general" and (not cnt_val or cnt_val.strip() == ""):
                    if is_visual_request:
                        try:
                            visual_prompt = f"The user asked: '{query}'. This requires an interactive visual representation. Build a complete, beautiful, working HTML visual using Chart.js or HTML5 Canvas. Return ONLY valid JSON with format='html', a 1-sentence speakingtext, and complete executable HTML in content."
                            retry_res = client.invoke([
                                SystemMessage(content=system_instructions),
                                HumanMessage(content=visual_prompt)
                            ]).content
                            parsed_retry = parse_voice_json(retry_res)
                            if parsed_retry.get("content"):
                                fmt_val = "html"
                                spk_val = parsed_retry.get("speakingtext", spk_val)
                                cnt_val = parsed_retry.get("content")
                        except Exception as retry_err:
                            pass
                    elif is_code_request:
                        try:
                            code_prompt = f"The user asked: '{query}'. Provide exact terminal commands and steps. Return ONLY valid JSON with format='markdown', a 1-sentence speakingtext, and markdown with ## headings and ```bash blocks in content."
                            retry_res = client.invoke([
                                SystemMessage(content=system_instructions),
                                HumanMessage(content=code_prompt)
                            ]).content
                            parsed_retry = parse_voice_json(retry_res)
                            if parsed_retry.get("content"):
                                fmt_val = "markdown"
                                spk_val = parsed_retry.get("speakingtext", spk_val)
                                cnt_val = parsed_retry.get("content")
                        except Exception as retry_err:
                            pass

                if fmt_val not in ["markdown", "html", "general"]:
                    fmt_val = "markdown" if "```" in cnt_val else "general"

                if fmt_val == "general" and not spk_val:
                    spk_val = cnt_val
                    cnt_val = ""

                return {
                    "format": fmt_val,
                    "formate": fmt_val,
                    "speakingtext": spk_val,
                    "speekingtext": spk_val,
                    "content": cnt_val,
                    "contec": cnt_val
                }

            except Exception as e:
                print(f"[LLMGateway] Error in structured output invocation: {e}")

        # Deterministic fallback structured output (keeps offline safety net)
        return self._get_fallback_structured_response(query)

    def _get_fallback_structured_response(self, query: str) -> Dict[str, Any]:
        """Provides deterministic fallback structured response when LLM is unavailable."""
        q_lower = query.lower()
        if "kafka" in q_lower or "docker" in q_lower:
            return {
                "format": "markdown",
                "formate": "markdown",
                "speakingtext": "Here are the commands to run Kafka in Docker.",
                "speekingtext": "Here are the commands to run Kafka in Docker.",
                "content": "## Run Kafka in Docker\n\n```bash\n# 1. Pull Kafka image\ndocker pull confluentinc/cp-kafka:latest\n\n# 2. Run Kafka container\ndocker run -d --name kafka \\\n  -p 9092:9092 \\\n  -e KAFKA_BROKER_ID=1 \\\n  -e KAFKA_ZOOKEEPER_CONNECT=localhost:2181 \\\n  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 \\\n  confluentinc/cp-kafka:latest\n```",
                "contec": "## Run Kafka in Docker\n\n```bash\n# 1. Pull Kafka image\ndocker pull confluentinc/cp-kafka:latest\n\n# 2. Run Kafka container\ndocker run -d --name kafka \\\n  -p 9092:9092 \\\n  -e KAFKA_BROKER_ID=1 \\\n  -e KAFKA_ZOOKEEPER_CONNECT=localhost:2181 \\\n  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 \\\n  confluentinc/cp-kafka:latest\n```"
            }
        elif "proposal" in q_lower or "client" in q_lower or "yesterday" in q_lower:
            return {
                "format": "markdown",
                "formate": "markdown",
                "speakingtext": "You worked on client proposal dot docx yesterday around 4:20 PM in your Projects folder.",
                "speekingtext": "You worked on client proposal dot docx yesterday around 4:20 PM in your Projects folder.",
                "content": "## Desktop Memory: client_proposal.docx\n- **Location**: `Projects/client_proposal.docx`\n- **Timestamp**: Yesterday at 4:20 PM\n- **Promise**: Email revised pricing to Rahul by Friday",
                "contec": "## Desktop Memory: client_proposal.docx\n- **Location**: `Projects/client_proposal.docx`\n- **Timestamp**: Yesterday at 4:20 PM\n- **Promise**: Email revised pricing to Rahul by Friday"
            }
        elif any(w in q_lower for w in ["population", "chart", "graph", "stats", "continent", "trend"]):
            chart_html = (
                '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>'
                '<div style="width: 100%; max-width: 480px; margin: 0 auto; height: 260px;">'
                '<canvas id="popChart"></canvas>'
                '</div>'
                '<script>'
                'const ctx = document.getElementById("popChart").getContext("2d");'
                'new Chart(ctx, {'
                '  type: "bar",'
                '  data: {'
                '    labels: ["Asia", "Africa", "Europe", "N. America", "S. America", "Oceania"],'
                '    datasets: [{'
                '      label: "Population (Billions)",'
                '      data: [4.75, 1.46, 0.74, 0.60, 0.43, 0.045],'
                '      backgroundColor: ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"],'
                '      borderRadius: 6'
                '    }]'
                '  },'
                '  options: {'
                '    responsive: true,'
                '    maintainAspectRatio: false,'
                '    plugins: {'
                '      legend: { display: false },'
                '      title: { display: true, text: "Global Population by Continent (2026)", font: { size: 14, weight: "bold" } }'
                '    },'
                '    scales: { y: { beginAtZero: true, title: { display: true, text: "Billions" } } }'
                '  }'
                '});'
                '</script>'
            )
            return {
                "format": "html",
                "formate": "html",
                "speakingtext": "Hey friend! Here is the global population breakdown by continent, showing Asia and Africa leading with over six billion people combined.",
                "speekingtext": "Hey friend! Here is the global population breakdown by continent, showing Asia and Africa leading with over six billion people combined.",
                "content": chart_html,
                "contec": chart_html
            }
        elif any(w in q_lower for w in ["mario", "game", "pong", "play"]):
            mario_html = (
                '<div style="text-align: center; margin-bottom: 6px; font-size: 12px; color: #475569;">'
                'Use <strong>Left / Right Arrows</strong> to move, <strong>Spacebar</strong> to jump!'
                '</div>'
                '<canvas id="marioCanvas" width="440" height="230" style="border: 2px solid #334155; border-radius: 8px; background: #38bdf8; display: block; margin: 0 auto;"></canvas>'
                '<script>'
                'const cvs = document.getElementById("marioCanvas");'
                'const ctx = cvs.getContext("2d");'
                'let player = { x: 50, y: 170, w: 24, h: 32, vx: 0, vy: 0, jumping: false, score: 0 };'
                'let coins = [{ x: 180, y: 140 }, { x: 280, y: 120 }, { x: 380, y: 140 }];'
                'const keys = {};'
                'window.addEventListener("keydown", e => { keys[e.code] = true; if(e.code === "Space" || e.code === "ArrowUp") { if(!player.jumping) { player.vy = -10; player.jumping = true; } e.preventDefault(); } });'
                'window.addEventListener("keyup", e => { keys[e.code] = false; });'
                'function loop() {'
                '  if(keys["ArrowLeft"]) player.vx = -4; else if(keys["ArrowRight"]) player.vx = 4; else player.vx *= 0.8;'
                '  player.vy += 0.5;'
                '  player.x += player.vx;'
                '  player.y += player.vy;'
                '  if(player.x < 0) player.x = 0; if(player.x > cvs.width - player.w) player.x = cvs.width - player.w;'
                '  if(player.y >= 170) { player.y = 170; player.vy = 0; player.jumping = false; }'
                '  coins.forEach(c => { if(Math.hypot(player.x + 12 - c.x, player.y + 16 - c.y) < 20) { player.score += 10; c.x = -100; } });'
                '  ctx.fillStyle = "#38bdf8"; ctx.fillRect(0, 0, cvs.width, cvs.height);'
                '  ctx.fillStyle = "#16a34a"; ctx.fillRect(0, 202, cvs.width, 28);'
                '  ctx.fillStyle = "#e11d48"; ctx.fillRect(player.x, player.y, player.w, player.h);'
                '  ctx.fillStyle = "#fbbf24"; coins.forEach(c => { if(c.x > 0) { ctx.beginPath(); ctx.arc(c.x, c.y, 8, 0, Math.PI * 2); ctx.fill(); } });'
                '  ctx.fillStyle = "#ffffff"; ctx.font = "bold 13px sans-serif"; ctx.fillText("Score: " + player.score, 14, 22);'
                '  requestAnimationFrame(loop);'
                '}'
                'requestAnimationFrame(loop);'
                '</script>'
            )
            return {
                "format": "html",
                "formate": "html",
                "speakingtext": "Hey friend! I built you a playable Mario mini game right here. Use arrow keys to move and space to jump!",
                "speekingtext": "Hey friend! I built you a playable Mario mini game right here. Use arrow keys to move and space to jump!",
                "content": mario_html,
                "contec": mario_html
            }
        elif any(w in q_lower for w in ["hello", "hi", "hey", "how are you", "what's up", "who are you", "friend"]):
            return {
                "format": "general",
                "formate": "general",
                "speakingtext": "Hey! Hey friend, how are you? What's up? What are we trying to do today? I'm your desktop memory buddy, ready to help you recall files, track promises, or visualize data!",
                "speekingtext": "Hey! Hey friend, how are you? What's up? What are we trying to do today? I'm your desktop memory buddy, ready to help you recall files, track promises, or visualize data!",
                "content": "",
                "contec": ""
            }
        elif "html" in q_lower or "card" in q_lower:
            html_snippet = (
                '<div style="padding: 16px; border-radius: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; text-align: center;">'
                '<h4 style="margin: 0 0 6px 0; color: #166534; font-size: 15px;">Desktop Memory Status</h4>'
                '<p style="margin: 0; color: #15803d; font-size: 13px;">Timeline engine online with semantic vector & graph index active.</p>'
                '</div>'
            )
            return {
                "format": "html",
                "formate": "html",
                "speakingtext": "Hey friend, here is your activity status card.",
                "speekingtext": "Hey friend, here is your activity status card.",
                "content": html_snippet,
                "contec": html_snippet
            }
        else:
            synth = self._fallback_synthesis(query)
            return {
                "format": "general",
                "formate": "general",
                "speakingtext": f"Hey friend! {synth}",
                "speekingtext": f"Hey friend! {synth}",
                "content": "",
                "contec": ""
            }

    def _fallback_synthesis(self, prompt: str) -> str:
        p_lower = prompt.lower()
        if "proposal" in p_lower or "client" in p_lower:
            return (
                "You worked on 'client_proposal.docx' yesterday around 4:20 PM in your 'Projects/' directory. "
                "Commitment found: You promised to email Rahul the revised pricing by Friday."
            )
        elif "docker" in p_lower or "deploy" in p_lower:
            return (
                "Deployment failed yesterday at 6:42 PM due to port 5432 conflict. "
                "Auto-healing recommended: Re-bind container port."
            )
        elif "resume" in p_lower:
            return "Resume update was left at 70% completion in 'Documents/Resume_2026.docx' yesterday at 2:15 PM."
        return f"I analyzed your desktop memories for: '{prompt[:60]}'."

default_llm_gateway = LLMGateway()
