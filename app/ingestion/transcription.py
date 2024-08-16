import os
import io
import asyncio
from typing import Dict, Any, List
from dotenv import load_dotenv
import logging
from pydub import AudioSegment
import tempfile
from openai import AzureOpenAI

logging.basicConfig(level=logging.WARN)
logger = logging.getLogger(__name__)
load_dotenv()

client = AzureOpenAI(
    api_key=os.getenv("AOAI_API_KEY"),  
    api_version=os.getenv("OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("OPENAI_API_BASE") 
)

class TranscriptionService:
    def __init__(self):
        logger.debug(f"Initialized TranscriptionService")

    async def transcribe_audio_chunk(self, audio_chunk: AudioSegment, chunk_number: int) -> str:
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
            audio_chunk.export(temp_file.name, format="mp3")
            
            with open(temp_file.name, "rb") as audio_file:
                buffer = io.BytesIO(audio_file.read())
                buffer.name = f"chunk_{chunk_number}.mp3"
                try:
                    result = client.audio.transcriptions.create(
                        model="whisper",
                        file=buffer,
                        response_format="srt"
                    )
                    return result
                except Exception as e:
                    logger.error(f"Error transcribing chunk {chunk_number}: {str(e)}")
                    raise
                finally:
                    buffer.close()
        os.unlink(temp_file.name)

    async def transcribe_audio(self, audio_file_path: str) -> List[Dict[str, Any]]:
        try:
            audio = AudioSegment.from_mp3(audio_file_path)
            chunk_size = 25 * 1024 * 1024 * 5
            chunks = []
            current_chunk = AudioSegment.empty()

            for i in range(0, len(audio), 1000):
                second = audio[i:i+1000]
                if len(current_chunk.raw_data) + len(second.raw_data) > chunk_size:
                    chunks.append(current_chunk)
                    current_chunk = AudioSegment.empty()
                current_chunk += second

            if len(current_chunk) > 0:
                chunks.append(current_chunk)

            processed_result = []
            for i, chunk in enumerate(chunks):
                print(f"Chunk {i+1} of {len(chunks)} is being transcribed.")
                transcription = await self.transcribe_audio_chunk(chunk, i)
                processed_result.append({
                    "chunk_number": i+1,
                    "transcription": transcription
                })
                print(f"Chunk {i+1} transcription complete.")

            print("Full processed result:")
            print(processed_result)  
            return processed_result
        except Exception as e:
            logger.error(f"Error during transcription: {str(e)}")
            raise

    def get_full_transcript(self, transcription: List[Dict[str, Any]]) -> str:
        full_transcript = ""
        for chunk in transcription:
            if 'transcription' in chunk:
                full_transcript += chunk['transcription'] + "\n\n"
        return full_transcript.strip()

def speech_to_text(audio_file):
    transcription_service = TranscriptionService()
    
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
        audio_file.save(temp_file.name)
        file_path = temp_file.name
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(transcription_service.transcribe_audio(file_path))
        
        full_srt = "\n\n".join([chunk['transcription'] for chunk in result])
        print("Full SRT for speech_to_text function is:")
        print(full_srt)
        
        return full_srt
    finally:
        os.unlink(file_path)