import os
from typing import Dict, Any, List
from flask import Response
import requests
from dotenv import load_dotenv

load_dotenv()

class ChatService:
    def __init__(self):
        self.config = self.get_openai_config()

    @staticmethod
    def get_openai_config() -> Dict[str, str]:
        return {
            "OPENAI_ENDPOINT": os.environ.get('OPENAI_ENDPOINT', ''),
            "AOAI_API_KEY": os.environ.get('AOAI_API_KEY', ''),
            "AZURE_OPENAI_DEPLOYMENT_ID": os.environ.get('AZURE_OPENAI_DEPLOYMENT_NAME', ''),
            "AZURE_OPENAI_DEPLOYMENT_NAME": os.environ.get('AZURE_OPENAI_DEPLOYMENT_NAME', ''),
            "SEARCH_SERVICE_ENDPOINT": os.environ.get('SEARCH_SERVICE_ENDPOINT', ''),
            "SEARCH_SERVICE_API_KEY": os.environ.get('SEARCH_SERVICE_API_KEY', ''),
        }

    def create_data_source(self, container_name: str) -> Dict[str, Any]:
        return {
            "type": "AzureCognitiveSearch",
            "parameters": {
                "endpoint": self.config['SEARCH_SERVICE_ENDPOINT'],
                "key": self.config['SEARCH_SERVICE_API_KEY'],
                "indexName": container_name
            }
        }

    def create_payload(self, messages: List[Dict[str, Any]], data_sources: List[Dict[str, Any]] = None, 
                       is_streaming: bool = False, max_tokens: int = 1000) -> Dict[str, Any]:
        payload = {
            "messages": messages,
            "stream": is_streaming,
            "max_tokens": max_tokens,
        }
        print (payload)
        print (data_sources)

        if data_sources:
            payload.update({
                "data_sources": data_sources
            })
        return payload

    def chat_with_data(self, data: Dict[str, Any], case_id) -> Response:
        messages = data
        index_name = case_id + "-ingestion"

        if not messages or not index_name:
            return {"error": "Messages and index name are required"}, 400

        url = f"{self.config['OPENAI_ENDPOINT']}/openai/deployments/{self.config['AZURE_OPENAI_DEPLOYMENT_ID']}/chat/completions?api-version=2024-02-15-preview"
        headers = {
            "Content-Type": "application/json",
            "api-key": self.config['AOAI_API_KEY']
        }
        
        index_name = case_id + "-ingestion"
        data_source = self.create_data_source(index_name)
        print (data_source)
        payload = self.create_payload(messages, [data_source], False) 
        print (payload)
        
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        print (response.json())
        return response.json()

    def stream_response(self, url: str, headers: Dict[str, str], payload: Dict[str, Any]) -> Response:
        return Response(self._stream_generator(url, headers, payload), content_type='application/x-ndjson')

    def _stream_generator(self, url: str, headers: Dict[str, str], payload: Dict[str, Any]):
        try:
            with requests.post(url, headers=headers, json=payload, stream=True) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if line:
                        yield line.decode('utf-8') + "\n"
        except requests.RequestException as e:
            yield f"{{\"error\": \"Failed to retrieve response: {str(e)}\"}}\n"

    def refine_message(self, data: Dict[str, Any]) -> Response:
        message = data.get("message")
        citations = data.get("citations", [])
        index_name = data.get("index_name")
        original_question = data.get("original_question")

        if not citations or not message or not index_name or not original_question:
            return {"error": "Message, citations, index name, and original question are required"}, 400

        url = f"{self.config['OPENAI_ENDPOINT']}/openai/deployments/{self.config['AZURE_OPENAI_DEPLOYMENT_ID']}/chat/completions?api-version=2024-02-15-preview"
        headers = {
            "Content-Type": "application/json",
            "api-key": self.config['AOAI_API_KEY']
        }

        refine_messages = self.create_refine_messages(message, citations, original_question)
        data_source = self.create_data_source(index_name)
        payload = self.create_payload(refine_messages, {}, {}, [data_source], True)
        print (payload)

        return self.stream_response(url, headers, payload)

    def create_refine_messages(self, message: str, citations: List[Dict[str, Any]], original_question: str) -> List[Dict[str, Any]]:
        system_message = (
            "You are an AI assistant tasked with answering specific questions based on "
            "additional information from documents. Only answer the question provided "
            "based on the information found in the documents. Do not provide new information. "
            "If the answer can't be found in the documents, answer 'No further information found'. "
            f"You must answer the question: {message}"
        )
        
        refine_messages = [{"role": "system", "content": system_message}]

        for citation in citations:
            refine_messages.append({"role": "user", "content": f"Citation: {citation.get('content', '')}"})

        refine_messages.append({"role": "assistant", "content": f"OK - I am now going to answer the question: {original_question}"})

        return refine_messages