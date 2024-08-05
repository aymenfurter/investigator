import os
from typing import Dict, Any, List, Optional
from azure.cosmos import CosmosClient, PartitionKey
from azure.cosmos.exceptions import CosmosHttpResponseError
from dotenv import load_dotenv

load_dotenv()

class CosmosDB:
    def __init__(self):
        self.endpoint = os.getenv("COSMOS_DB_ENDPOINT")
        self.key = os.getenv("COSMOS_DB_KEY")
        self.database_name = os.getenv("COSMOS_DB_DATABASE")
        self.container_name = os.getenv("COSMOS_DB_CONTAINER")

        self.client = CosmosClient(self.endpoint, self.key)
        self.database = self.client.get_database_client(self.database_name)
        self.container = self.database.get_container_client(self.container_name)

    def create_case(self, case_id: str, description: str) -> Dict[str, Any]:
        """Create a new case in Cosmos DB."""
        case_item = {
            "id": case_id,
            "description": description,
            "files": [],
            "graph": {"nodes": [], "relationships": []},
            "status": "created"
        }
        try:
            created_item = self.container.create_item(body=case_item)
            return created_item
        except CosmosHttpResponseError as e:
            if e.status_code == 409:  # Conflict error code
                raise ValueError(f"Case with ID {case_id} already exists.")
            else:
                raise

    def get_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a case from Cosmos DB by its ID."""
        try:
            return self.container.read_item(item=case_id, partition_key=case_id)
        except CosmosHttpResponseError as e:
            if e.status_code == 404:
                return None
            else:
                raise

    def update_case(self, case_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing case in Cosmos DB."""
        try:
            case = self.get_case(case_id)
            if not case:
                raise ValueError(f"Case with ID {case_id} not found.")
            
            case.update(updates)
            updated_case = self.container.replace_item(item=case_id, body=case)
            return updated_case
        except CosmosHttpResponseError as e:
            raise ValueError(f"Error updating case: {str(e)}")

    def update_case_status(self, case_id: str, status: str) -> Dict[str, Any]:
        """Update the status of an existing case in Cosmos DB."""
        return self.update_case(case_id, {"status": status})

    def delete_case(self, case_id: str) -> None:
        """Delete a case from Cosmos DB."""
        try:
            self.container.delete_item(item=case_id, partition_key=case_id)
        except CosmosHttpResponseError as e:
            if e.status_code != 404:  # If it's not a "not found" error, raise it
                raise

    def list_cases(self) -> List[Dict[str, Any]]:
        """List all cases in Cosmos DB."""
        query = "SELECT c.id, c.description, c.status FROM c"
        items = list(self.container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))
        return items

    def add_file_to_case(self, case_id: str, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Add a file to an existing case."""
        try:
            case = self.get_case(case_id)
            if not case:
                raise ValueError(f"Case with ID {case_id} not found.")
            
            case['files'].append(file_info)
            updated_case = self.container.replace_item(item=case_id, body=case)
            return updated_case
        except CosmosHttpResponseError as e:
            raise ValueError(f"Error adding file to case: {str(e)}")

    def remove_file_from_case(self, case_id: str, file_name: str) -> Dict[str, Any]:
        """Remove a file from an existing case."""
        try:
            case = self.get_case(case_id)
            if not case:
                raise ValueError(f"Case with ID {case_id} not found.")
            
            case['files'] = [f for f in case['files'] if f['name'] != file_name]
            updated_case = self.container.replace_item(item=case_id, body=case)
            return updated_case
        except CosmosHttpResponseError as e:
            raise ValueError(f"Error removing file from case: {str(e)}")

    def update_graph(self, case_id: str, graph: Dict[str, Any]) -> Dict[str, Any]:
        """Update the knowledge graph for a case."""
        try:
            case = self.get_case(case_id)
            if not case:
                raise ValueError(f"Case with ID {case_id} not found.")
            
            case['graph'] = graph
            updated_case = self.container.replace_item(item=case_id, body=case)
            return updated_case
        except CosmosHttpResponseError as e:
            raise ValueError(f"Error updating graph for case: {str(e)}")

    def get_graph(self, case_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve the knowledge graph for a case."""
        case = self.get_case(case_id)
        if case:
            return case.get('graph')
        return None