import os
import asyncio
from typing import Dict, Any, List
from azure.storage.blob import BlobServiceClient, ContainerClient
from azure.core.exceptions import ResourceExistsError
from azure.storage.queue import QueueClient
from ingestion.transcription import TranscriptionService
from ingestion.graph_generator import GraphGenerator
from integration.cosmos_db import CosmosDB
from dotenv import load_dotenv
import json
import logging
import tempfile
import requests

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class IngestionJobApi:
    def __init__(self):
        self.openai_endpoint = os.environ['OPENAI_API_BASE']
        self.aoai_api_key = os.environ['AOAI_API_KEY']
        self.search_service_endpoint = os.environ['SEARCH_SERVICE_ENDPOINT']
        self.search_service_api_key = os.environ['SEARCH_SERVICE_API_KEY']
        self.storage_account_name = os.environ['STORAGE_ACCOUNT_NAME']
        self.subscription_id = os.environ['SUBSCRIPTION_ID']
        self.resource_group = os.environ['RESOURCE_GROUP']
        self.ada_deployment_name = os.environ['EMBEDDING_MODEL_DEPLOYMENT_NAME']

    def create_ingestion_job(self, container_name: str) -> Dict[str, Any]:
        url = f"{self.openai_endpoint}/openai/ingestion/jobs/{container_name}?api-version=2024-05-01-preview"
        headers = {'api-key': self.aoai_api_key, 'Content-Type': 'application/json'}
        payload = {
            "kind": "system",
            "searchServiceConnection": {"kind": "EndpointWithManagedIdentity", "endpoint": self.search_service_endpoint},
            "datasource": {
                "kind": "Storage",
                "storageAccountConnection": {
                    "kind": "EndpointWithManagedIdentity",
                    "endpoint": f"https://{self.storage_account_name}.blob.core.windows.net/",
                    "resourceId": f"/subscriptions/{self.subscription_id}/resourceGroups/{self.resource_group}/providers/Microsoft.Storage/storageAccounts/{self.storage_account_name}"
                },
                "containerName": container_name,
                "chunkingSettings": {"maxChunkSizeInTokens": 2048},
                "embeddingsSettings": [{"embeddingResourceConnection": {"kind": "RelativeConnection"}, "modelProvider": "AOAI", "deploymentName": self.ada_deployment_name}]
            },
            "completionAction": 1
        }
        response = requests.put(url, headers=headers, json=payload)
        return {"status": "initiated", "job_id": container_name, "message": "Indexing job initiated successfully"} if response.status_code == 200 else {"status": "error", "message": f"Failed to create ingestion job: {response.text}"}


class AudioFileProcessor:
    def __init__(self):
        self.storage_account_name = os.getenv('STORAGE_ACCOUNT_NAME')
        self.storage_account_key = os.getenv('STORAGE_ACCOUNT_KEY')
        self.queue_name = "audio-processing-queue"

        self.blob_service_client = BlobServiceClient(
            account_url=f"https://{self.storage_account_name}.blob.core.windows.net",
            credential=self.storage_account_key
        )
        self.queue_client = QueueClient.from_connection_string(
            conn_str=f"DefaultEndpointsProtocol=https;AccountName={self.storage_account_name};AccountKey={self.storage_account_key};EndpointSuffix=core.windows.net",
            queue_name=self.queue_name
        )

        self.transcription_service = TranscriptionService()
        self.graph_generator = GraphGenerator()
        self.ingestion_job_api = IngestionJobApi()
        self.cosmos_db = CosmosDB()

        self.is_processing = False

        self.initialize_azure_resources()

    def initialize_azure_resources(self):
        try:
            self.queue_client.create_queue()
        except ResourceExistsError:
            pass

    def ensure_container_exists(self, container_name: str) -> ContainerClient:
        container_client = self.blob_service_client.get_container_client(container_name)
        try:
            container_client.create_container()
        except ResourceExistsError:
            pass
        return container_client

    async def upload_audio_file(self, file_path: str, case_id: str) -> str:
        file_name = os.path.basename(file_path)
        container_client = self.ensure_container_exists(case_id)
        blob_client = container_client.get_blob_client(file_name)
        
        with open(file_path, "rb") as data:
            blob_client.upload_blob(data, overwrite=True)
        
        return blob_client.url

    async def process_audio_file(self, case_id: str, filename: str, blob_url: str):
        try:
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
            temp_file.close()
            
            blob_client = self.blob_service_client.get_blob_client(container=case_id, blob=filename)
            with open(temp_file.name, "wb") as file:
                blob_data = blob_client.download_blob()
                file.write(blob_data.readall())

            logger.info(f"Blob downloaded to temporary file: {temp_file.name}")

            transcription = await self.transcription_service.transcribe_audio(temp_file.name)
            if not transcription:
                raise ValueError("Transcription is empty")

            logger.info("Audio file transcribed")

            os.unlink(temp_file.name)
            logger.info("Temporary file removed")

            # Add filename to each chunk
            for chunk in transcription:
                chunk['filename'] = filename

            await self.store_transcription_by_minute(case_id, filename, transcription)
            logger.info("Transcription stored by minute")

            ingestion_container = f"{case_id}-ingestion"
            self.ensure_container_exists(ingestion_container)
            job_result = self.ingestion_job_api.create_ingestion_job(ingestion_container)
            
            if job_result["status"] == "error":
                raise Exception(f"Failed to create ingestion job: {job_result['message']}")

            logger.info("Ingestion job created")

            await self.update_knowledge_graph(case_id, transcription)
            logger.info("Knowledge graph updated")

            self.cosmos_db.update_case(case_id, {'files': self.cosmos_db.get_case(case_id).get('files', []) + [filename]})

            logger.info(f"Successfully processed audio file: {filename} for case: {case_id}")
            logger.info(f"Ingestion job created: {job_result}")
        except Exception as e:
            logger.error(f"Error processing audio file {filename} for case {case_id}: {str(e)}")
            self.cosmos_db.update_case_status(case_id, "error")
        
        logger.info(f"Processing status for case {case_id}: completed")

    async def store_transcription_by_minute(self, case_id: str, filename: str, transcription: List[Dict[str, Any]]):
        ingestion_container = f"{case_id}-ingestion"
        container_client = self.ensure_container_exists(ingestion_container)

        for segment in transcription:
            if 'transcription' in segment:
                lines = segment['transcription'].split('\n')
                i = 0
                while i < len(lines):
                    if '-->' in lines[i]:
                        time_range = lines[i]
                        start_time = time_range.split(' --> ')[0]
                        minutes, seconds = start_time.split(':')[1:3]
                        seconds = seconds.split(',')[0]
                        
                        blob_name = f"{filename}__min{int(minutes):02d}_{int(seconds):02d}.txt"
                        blob_client = container_client.get_blob_client(blob_name)
                        
                        text = lines[i+1] if i+1 < len(lines) else ""
                        content = f"Time: {time_range}\nText: {text}\n"
                        blob_client.upload_blob(content, overwrite=True)
                        
                        i += 2
                    else:
                        i += 1
        logger.info(f"Transcription stored by time segments for case {case_id}")

    async def update_knowledge_graph(self, case_id: str, transcription: List[Dict[str, Any]]):
        try:
            current_graph = self.cosmos_db.get_graph(case_id) or {"nodes": [], "relationships": [], "timecodes": {}}
            updated_graph = await self.graph_generator.generate_graph(transcription, case_id)
            self.cosmos_db.update_graph(case_id, updated_graph)
            logger.info(f"Successfully updated knowledge graph for case: {case_id}")
        except Exception as e:
            logger.error(f"Error updating knowledge graph for case {case_id}: {str(e)}")
            raise

    def queue_audio_processing(self, case_id: str, filename: str, blob_url: str):
        message_content = json.dumps({"case_id": case_id, "filename": filename, "blob_url": blob_url})
        self.queue_client.send_message(message_content)

    async def process_queue(self):
        logger.info("Processing queue")
        self.is_processing = True
        while self.is_processing:
            messages = self.queue_client.receive_messages(messages_per_page=1)
            for message in messages:
                try:
                    message_content = json.loads(message.content)
                    case_id = message_content["case_id"]
                    filename = message_content["filename"]
                    blob_url = message_content["blob_url"]
                    
                    self.cosmos_db.update_case_status(case_id, "processing")
                    
                    logger.info(f"Processing audio file: {filename} for case: {case_id}")
                    await self.process_audio_file(case_id, filename, blob_url)
                    
                    self.cosmos_db.update_case_status(case_id, "completed")
                    
                    self.queue_client.delete_message(message)
                    logger.info(f"Processed audio file: {filename} for case: {case_id}")
                except Exception as e:
                    logger.error(f"Error processing message: {str(e)}")
                    self.cosmos_db.update_case_status(case_id, "error")
            await asyncio.sleep(10)

    def stop_processing(self):
        self.is_processing = False

    async def delete_all_audio_files(self, case_id: str) -> bool:
        try:
            container_client = self.ensure_container_exists(case_id)
            blobs = container_client.list_blobs()
            for blob in blobs:
                container_client.delete_blob(blob.name)
            return True
        except Exception as e:
            logger.error(f"Error deleting audio files for case {case_id}: {str(e)}")
            return False

async def start_queue_processing():
    processor = AudioFileProcessor()
    await processor.process_queue()

if __name__ == "__main__":
    asyncio.run(start_queue_processing())