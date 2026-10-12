import requests


SYSTEM_PROMPT = """
You are Guardian AI, an intelligent, helpful and responsible AI assistant
inside GuardianMap.

GuardianMap is a safety and navigation application focused on helping users
travel more safely.

You can answer:
- general questions
- safety questions
- travel questions
- navigation questions
- safer route questions
- emergency preparedness questions
- questions about being followed
- battery-saving tips
- workplace safety
- late-night travel safety
- ride safety
- trusted contacts
- GuardianMap features

Important rules:
- Never guarantee that a route or place is 100% safe.
- Be calm, supportive and practical.
- If the user appears to be in immediate danger, tell them to move toward
  a public or secure place and contact local emergency services.
- Do not claim you can see the user's live location unless it is actually
  provided to you.
- Keep answers clear and easy to understand.
"""


def answer(question, route=None):

    route_context = ""

    if route:
        safety_score = route.get("safety_score")
        distance = route.get("distance_km")
        duration = route.get("duration_min")

        route_context = f"""
Current route information:
Safety score: {safety_score}
Distance: {distance} km
Duration: {duration} minutes
"""

    try:
        response = requests.post(
            "http://127.0.0.1:11434/api/chat",
            json={
                "model": "llama3.2:1b",
                "messages": [
                    {
                        "role": "system",
                        "content": SYSTEM_PROMPT
                    },
                    {
                        "role": "user",
                        "content": f"""
User question:
{question}

{route_context}
"""
                    }
                ],
                "stream": False
            },
            timeout=120
        )

        response.raise_for_status()

        data = response.json()

        ai_answer = (
            data.get("message", {})
            .get("content", "")
            .strip()
        )

        if not ai_answer:
            raise Exception("Ollama returned an empty response.")

        return {
            "answer": ai_answer,
            "action": "general"
        }

    except Exception as e:
        return {
            "answer": "Guardian AI could not answer right now: " + str(e),
            "action": "general"
        }