import anthropic
from pathlib import Path
from functools import lru_cache
from ..config import get_settings

settings = get_settings()

PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"

MODEL = "claude-sonnet-4-6"


@lru_cache
def load_prompt(filename: str) -> str:
    return (PROMPTS_DIR / filename).read_text(encoding="utf-8")


def get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


async def run_step(step_number: int, user_message: str, prior_steps: dict) -> str:
    """Run a research wizard step through Claude with prompt caching."""
    step_files = {
        1: "step1_topic.txt",
        2: "step2_question.txt",
        3: "step3_hypothesis.txt",
        4: "step4_variables.txt",
        5: "step5_method.txt",
        6: "step6_instrument.txt",
        7: "step7_analysis.txt",
        8: "step8_limitations.txt",
    }

    system_base = load_prompt("system_base.txt")
    step_prompt = load_prompt(step_files[step_number])

    prior_context = ""
    if prior_steps:
        parts = []
        for step_num in sorted(prior_steps.keys()):
            step_data = prior_steps[step_num]
            parts.append(f"=== Step {step_num} ===\n{step_data.get('ai_response', '')}")
        prior_context = "\n\n".join(parts)

    full_user_message = user_message
    if prior_context:
        full_user_message = f"PRIOR RESEARCH CONTEXT:\n{prior_context}\n\nCURRENT INPUT:\n{user_message}"

    client = get_client()
    message = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=[
            {
                "type": "text",
                "text": system_base,
                "cache_control": {"type": "ephemeral"},
            },
            {
                "type": "text",
                "text": step_prompt,
                "cache_control": {"type": "ephemeral"},
            },
        ],
        messages=[{"role": "user", "content": full_user_message}],
    )
    return message.content[0].text


async def interpret_analysis(test_type: str, result_json: dict, project_context: str) -> str:
    """Generate APA-format interpretation paragraph for statistical results."""
    interpret_prompt = load_prompt("step7_interpret.txt")
    system_base = load_prompt("system_base.txt")

    user_message = (
        f"TEST TYPE: {test_type}\n"
        f"RESULTS: {result_json}\n"
        f"PROJECT CONTEXT: {project_context}"
    )

    client = get_client()
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": system_base,
                "cache_control": {"type": "ephemeral"},
            },
            {
                "type": "text",
                "text": interpret_prompt,
                "cache_control": {"type": "ephemeral"},
            },
        ],
        messages=[{"role": "user", "content": user_message}],
    )
    return message.content[0].text


async def generate_apa_document(project_data: dict) -> dict:
    """Generate complete APA 7th edition document sections."""
    apa_prompt = load_prompt("apa_document.txt")
    system_base = load_prompt("system_base.txt")

    import json
    user_message = f"PROJECT DATA:\n{json.dumps(project_data, indent=2)}"

    client = get_client()
    message = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": system_base,
                "cache_control": {"type": "ephemeral"},
            },
            {
                "type": "text",
                "text": apa_prompt,
                "cache_control": {"type": "ephemeral"},
            },
        ],
        messages=[{"role": "user", "content": user_message}],
    )
    raw = message.content[0].text

    try:
        import re
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception:
        pass

    return {"raw": raw}
