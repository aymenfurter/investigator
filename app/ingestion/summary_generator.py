import os
from typing import List, Dict, Any
from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()

class SummaryGenerator:
    def __init__(self):
        self.openai_client = AzureOpenAI(
            api_key=os.getenv("AOAI_API_KEY"),
            api_version=os.getenv("OPENAI_API_VERSION"),
            azure_endpoint=os.getenv("OPENAI_API_BASE")
        )

    async def generate_summary(self, transcription: List[Dict[str, Any]]) -> str:
        full_text = " ".join([chunk['transcription'] for chunk in transcription if 'transcription' in chunk])
        
        response = self.openai_client.chat.completions.create(
            model=os.getenv("GPT_MODEL_DEPLOYMENT_NAME"),
            messages=[
                {"role": "system", "content": "You are an AI assistant tasked with summarizing audio transcripts."},
                {"role": "user", "content": f"Please provide a concise summary of the following transcript:\n\n{full_text}"}
            ],
            max_tokens=500
        )
        
        return response.choices[0].message.content.strip()