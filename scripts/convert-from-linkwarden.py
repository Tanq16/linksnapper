#!/usr/bin/env python3

import json
from typing import Dict, List

def build_collection_paths(collections: List[Dict]) -> Dict[int, List[str]]:
    """Build complete paths for each collection based on parent relationships."""
    # Create lookup dictionary for collections by ID
    collection_map = {c['id']: c for c in collections}
    paths = {}
    
    def get_path(coll_id: int) -> List[str]:
        """Recursively build path for a collection."""
        if coll_id in paths:
            return paths[coll_id]
            
        collection = collection_map[coll_id]
        parent_id = collection.get('parentId')
        
        if parent_id is None:
            # Base case: no parent
            path = [collection['name']]
        else:
            # Recursive case: prepend parent path
            path = get_path(parent_id) + [collection['name']]
            
        paths[coll_id] = path
        return path
    
    # Build paths for all collections
    for collection in collections:
        if collection['id'] not in paths:
            paths[collection['id']] = get_path(collection['id'])
    
    return paths

def convert_backup(input_file: str = 'backup.json', output_file: str = 'output.json'):
    """Convert Linkwarden backup to Linksnapper format."""
    # Read input file
    with open(input_file, 'r', encoding='utf-8') as f:
        backup = json.load(f)
    
    # Build collection paths
    collection_paths = build_collection_paths(backup['collections'])
    
    # Convert links to Linksnapper format
    converted_links = []
    
    for collection in backup['collections']:
        # Get path for this collection
        path = collection_paths[collection['id']]
        
        # Process links in this collection
        for link in collection.get('links', []):
            converted_link = {
                'url': link['url'],
                'name': link['name'],
                'description': link.get('description', ''),
                'path': path
            }
            converted_links.append(converted_link)
    
    # Write output file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(converted_links, f, indent=2, ensure_ascii=False)
    
    print(f"Converted {len(converted_links)} links")
    print(f"Output written to {output_file}")

if __name__ == '__main__':
    convert_backup()
