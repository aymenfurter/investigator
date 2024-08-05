import os
from flask import Blueprint, request, jsonify
from integration.cosmos_db import CosmosDB
from ingestion.audio_processor import AudioFileProcessor, start_queue_processing
from query.chat_service import ChatService
import asyncio
from azure.identity import DefaultAzureCredential
import threading
from azure.storage.blob import BlobServiceClient, ContainerClient
import io
from flask import Response

api = Blueprint('api', __name__)
credential = DefaultAzureCredential()
cosmos_db = CosmosDB()
audio_processor = AudioFileProcessor()
chat_service = ChatService()

def run_queue_processing():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(start_queue_processing())

queue_thread = threading.Thread(target=run_queue_processing)
queue_thread.start()

@api.route('/cases', methods=['GET'])
def get_cases():
    cases = cosmos_db.list_cases()
    return jsonify(cases), 200

@api.route('/cases', methods=['POST'])
def create_case():
    data = request.json
    case_id = data.get('id')
    description = data.get('description')
    if not case_id or not description:
        return jsonify({"error": "Both id and description are required"}), 400
    try:
        new_case = cosmos_db.create_case(case_id, description)
        return jsonify(new_case), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 409

@api.route('/cases/<case_id>', methods=['GET'])
def get_case(case_id):
    case = cosmos_db.get_case(case_id)
    if case:
        return jsonify(case), 200
    return jsonify({"error": "Case not found"}), 404

@api.route('/cases/<case_id>/upload', methods=['POST'])
async def upload_file(case_id):
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if not file.filename.lower().endswith('.mp3'):
        return jsonify({"error": "Only MP3 files are allowed"}), 400
    
    try:
        temp_file_path = f"/tmp/{file.filename}"
        file.save(temp_file_path)
        blob_url = await audio_processor.upload_audio_file(temp_file_path, case_id)
        os.remove(temp_file_path)

        audio_processor.queue_audio_processing(case_id, file.filename, blob_url)
        
        cosmos_db.update_case_status(case_id, "queued")

        return jsonify({"message": "File uploaded successfully and processing initiated"}), 202

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api.route('/cases/<case_id>/files', methods=['GET'])
def get_files(case_id):
    case = cosmos_db.get_case(case_id)
    case = cosmos_db.update_case(case_id, {'files': list(set(case.get('files', [])) )})
    if case:
        return jsonify(case.get('files', [])), 200
    return jsonify({"error": "Case not found"}), 404

@api.route('/cases/<case_id>/files', methods=['DELETE'])
async def delete_all_files(case_id):
    case = cosmos_db.get_case(case_id)
    if not case:
        return jsonify({"error": "Case not found"}), 404
    
    success = await audio_processor.delete_all_audio_files(case_id)
    if success:
        cosmos_db.update_case(case_id, {'files': []})
        cosmos_db.update_graph(case_id, {"nodes": [], "relationships": []})
        return jsonify({"message": "All files deleted and reindexing initiated"}), 200
    return jsonify({"error": "Failed to delete files"}), 500

@api.route('/cases/<case_id>/chat', methods=['POST'])
async def chat(case_id):
    data = request.json
    messages = data.get('messages')
    if not messages or not isinstance(messages, list):
        return jsonify({"error": "Invalid messages format"}), 400
    
    response = chat_service.chat_with_data(messages, case_id)
    return response

@api.route('/cases/<case_id>/refine', methods=['POST'])
async def refine(case_id):
    data = request.json
    message = data.get('message')
    citations = data.get('citations')
    original_question = data.get('original_question')
    if not message or not citations or not original_question:
        return jsonify({"error": "Message, citations, and original question are required"}), 400
    
    response = await chat_service.refine_message(message, citations, case_id, True, original_question)
    return jsonify(response), 200

@api.route('/cases/<case_id>/status', methods=['GET'])
def get_case_status(case_id):
    case = cosmos_db.get_case(case_id)
    if case:
        return jsonify({"status": case.get('status', 'unknown')}), 200
    return jsonify({"error": "Case not found"}), 404

@api.route('/dashboard', methods=['GET'])
def get_dashboard():
    cases = cosmos_db.list_cases()
    total_cases = len(cases)
    total_minutes = sum(len(case.get('files', [])) for case in cases)
    return jsonify({
        "total_cases": total_cases,
        "total_minutes_ingested": total_minutes
    }), 200

@api.route('/cases/<case_id>/audio/<filename>', methods=['GET'])
def get_audio_file(case_id, filename):
    try:
        # Initialize the BlobServiceClient
        blob_service_client = BlobServiceClient(
            account_url=f"https://{audio_processor.storage_account_name}.blob.core.windows.net",
            credential=audio_processor.storage_account_key
        )

        # Get a reference to the container
        container_client = blob_service_client.get_container_client(case_id)

        # Get a reference to the blob
        blob_client = container_client.get_blob_client(filename)

        # Download the blob
        download_stream = blob_client.download_blob()

        # Create a BytesIO object from the downloaded stream
        audio_data = io.BytesIO()
        download_stream.readinto(audio_data)
        audio_data.seek(0)

        # Return the file as a streaming response
        return Response(
            audio_data,
            mimetype="audio/mpeg",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500