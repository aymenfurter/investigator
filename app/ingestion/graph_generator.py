import os
import json
import logging
from typing import List, Dict, Any
from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()

class GraphGenerator:
    def __init__(self):
        self.client = AzureOpenAI(
            azure_endpoint = os.getenv("OPENAI_API_BASE"),
            api_key=os.getenv("AOAI_API_KEY"),
            api_version="2023-05-15"
        )
        self.deployment_name = os.getenv("GPT_MODEL_DEPLOYMENT_NAME")
        self.logger = logging.getLogger(__name__)

    async def generate_graph(self, transcription: List[Dict[str, Any]], case_id: str) -> Dict[str, Any]:
        full_graph = {"nodes": [], "relationships": [], "timecodes": {}}
        chunk_size = 20 * 60  # 20 minutes in seconds

        for chunk in transcription:
            try:
                updated_graph = await self._process_chunk(chunk, full_graph)
                full_graph = self._merge_graphs(full_graph, updated_graph)
            except Exception as e:
                self.logger.error(f"Error processing chunk for case {case_id}: {str(e)}")
                # Continue processing other chunks

        return full_graph

    async def _process_chunk(self, chunk: Dict[str, Any], current_graph: Dict[str, Any]) -> Dict[str, Any]:
        prompt = self._create_prompt(chunk, current_graph)
        response = await self._get_completion(prompt)
        return self._parse_response(response, chunk)

    def _create_prompt(self, chunk: Dict[str, Any], current_graph: Dict[str, Any]) -> str:
        chunk_text = self._format_chunk(chunk)
        graph_json = json.dumps(current_graph, indent=2)

        prompt = f"""
        You are an AI assistant tasked with generating a knowledge graph from audio transcription data.
        The current knowledge graph is:
        {graph_json}

        Please analyze the following chunk of transcription and update the knowledge graph:
        {chunk_text}

        Generate new nodes and relationships based on the information in this chunk.
        If you identify entities or relationships that already exist in the current graph, update or add to them as necessary.
        Provide your response in JSON format with 'nodes', 'relationships', and 'timecodes' keys.

        Follow these guidelines:
        1. Use these node types: 'Person', 'Location', 'Event', 'Evidence', 'Statement'.
        2. Use human-readable identifiers for node IDs, not integers.
        3. Ensure relationship types are general and timeless.
        4. Maintain entity consistency across references.
        5. Only include information explicitly mentioned in the text.
        6. For 'Statement' nodes, include properties for 'type' (e.g., 'confession', 'denial', 'observation') and 'content'.
        7. Include timecodes for each node, representing when the entity or statement is first mentioned.

        Your response should be in this format:
        {{
            "nodes": [
                {{"id": "John_Doe", "type": "Person", "properties": {{"role": "Suspect"}}}},
                {{"id": "Downtown_Park", "type": "Location", "properties": {{"description": "Place of the incident"}}}},
                {{"id": "Robbery_Incident", "type": "Event", "properties": {{"description": "Armed robbery at Downtown Park"}}}},
                {{"id": "Johns_Statement", "type": "Statement", "properties": {{"type": "Denial", "content": "I was not at the park during the robbery."}}}}
            ],
            "relationships": [
                {{"source": "John_Doe", "target": "Robbery_Incident", "type": "INVOLVED_IN"}},
                {{"source": "Downtown_Park", "target": "Robbery_Incident", "type": "LOCATION_OF"}},
                {{"source": "Johns_Statement", "target": "John_Doe", "type": "MADE_BY"}}
            ],
            "timecodes": {{
                "John_Doe": ["00:02:15"],
                "Downtown_Park": ["00:01:05"],
                "Robbery_Incident": ["00:01:05"],
                "Johns_Statement": ["00:02:50"]
            }}
        }}
        """
        return prompt

    def _format_chunk(self, chunk: Dict[str, Any]) -> str:
        formatted_chunk = ""
        lines = chunk['transcription'].split('\n')
        for line in lines:
            if '-->' not in line:
                formatted_chunk += f"{line}\n"
        return formatted_chunk

    async def _get_completion(self, prompt: str) -> str:
        try:
            response = self.client.chat.completions.create(
                model=self.deployment_name,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that generates knowledge graphs from transcription data."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                max_tokens=4000
            )
            json_output = response.choices[0].message.content
            return json_output.replace('```json', '').replace('```', '')
        except Exception as e:
            self.logger.error(f"Error getting completion from OpenAI: {str(e)}")
            raise

    def _parse_response(self, response: str, chunk: Dict[str, Any]) -> Dict[str, Any]:
        try:
            graph_data = json.loads(response)
            graph_data['timecodes'] = self._convert_timecodes(chunk, graph_data.get('timecodes', {}))
            return graph_data
        except json.JSONDecodeError:
            self.logger.error(f"Error parsing JSON response: {response}")
            return {"nodes": [], "relationships": [], "timecodes": {}}

    def _convert_timecodes(self, chunk: Dict[str, Any], timecodes: Dict[str, List[str]]) -> Dict[str, List[str]]:
        converted_timecodes = {}
        filename = chunk.get('filename', 'unknown')

        for entity, times in timecodes.items():
            converted_timecodes[entity] = []
            for time in times:
                seconds = self._time_to_seconds(time)
                minutes, seconds = divmod(seconds, 60)
                converted_time = f"{filename}__min{minutes:02d}_{seconds:02d}"
                converted_timecodes[entity].append(converted_time)

        return converted_timecodes

    def _time_to_seconds(self, time: str) -> int:
        try:
            h, m, s = map(float, time.replace(',', '.').split(':'))
            return int(h * 3600 + m * 60 + s)
        except ValueError:
            self.logger.warning(f"Invalid time format: {time}")
            return 0

    def _merge_graphs(self, graph1: Dict[str, Any], graph2: Dict[str, Any]) -> Dict[str, Any]:
        merged_graph = {
            "nodes": graph1.get("nodes", []) + graph2.get("nodes", []),
            "relationships": graph1.get("relationships", []) + graph2.get("relationships", []),
            "timecodes": {**graph1.get("timecodes", {}), **graph2.get("timecodes", {})}
        }

        unique_nodes = {node["id"]: node for node in merged_graph["nodes"]}
        unique_relationships = set()
        unique_rel_list = []

        for rel in merged_graph["relationships"]:
            if isinstance(rel, dict) and all(key in rel for key in ["source", "target", "type"]):
                rel_tuple = (rel["source"], rel["target"], rel["type"])
                if rel_tuple not in unique_relationships:
                    unique_relationships.add(rel_tuple)
                    unique_rel_list.append(rel)
            else:
                self.logger.warning(f"Skipping invalid relationship: {rel}")

        for entity in merged_graph["timecodes"]:
            merged_graph["timecodes"][entity] = list(set(merged_graph["timecodes"][entity]))

        return {
            "nodes": list(unique_nodes.values()),
            "relationships": unique_rel_list,
            "timecodes": merged_graph["timecodes"]
        }