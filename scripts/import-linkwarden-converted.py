#!/usr/bin/env python3

import json
import requests
from time import sleep
from typing import Dict, List
from concurrent.futures import ThreadPoolExecutor
from tqdm import tqdm

LINKSNAPPER_URL = "https://links.etherios.work/api/links"

def add_link(link: Dict) -> bool:
    """Add a single link to Linksnapper."""
    try:
        response = requests.post(LINKSNAPPER_URL, json=link)
        if response.status_code == 201:
            return True
        else:
            print(f"Failed to add {link['name']}: {response.status_code}")
            return False
    except Exception as e:
        print(f"Error adding {link['name']}: {str(e)}")
        return False

def import_links(input_file: str = 'final.json', max_workers: int = 5):
    """Import links from file into Linksnapper."""
    # Read the converted links
    with open(input_file, 'r', encoding='utf-8') as f:
        links = json.load(f)
    
    print(f"Found {len(links)} links to import")
    
    # Verify Linksnapper is accessible
    try:
        health_check = requests.get("https://links.etherios.work/api/health")
        if health_check.status_code != 200:
            print("Error: Linksnapper is not responding")
            return
    except Exception as e:
        print(f"Error connecting to Linksnapper: {str(e)}")
        return
    
    successful = 0
    failed = 0
    
    # Use ThreadPoolExecutor for parallel processing
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Create a progress bar
        results = list(tqdm(
            executor.map(add_link, links),
            total=len(links),
            desc="Importing links",
            unit="link"
        ))
        
        # Count results
        successful = sum(1 for r in results if r)
        failed = sum(1 for r in results if not r)
    
    print(f"\nImport completed:")
    print(f"- Successfully imported: {successful}")
    print(f"- Failed to import: {failed}")

if __name__ == '__main__':
    import_links()

