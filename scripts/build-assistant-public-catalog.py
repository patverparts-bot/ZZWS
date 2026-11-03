"""Compatibility entry point; use the assistant's canonical classifier."""
import json
import subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def build(enriched, knowledge):
    result = subprocess.run(['node', str(ROOT / 'scripts/build-assistant-taxonomy.mjs'), '--stdin'], input=json.dumps({'enriched': enriched, 'knowledge': knowledge}), text=True, encoding='utf-8', capture_output=True, check=True)
    return json.loads(result.stdout)

if __name__ == '__main__':
    subprocess.run(['node', str(ROOT / 'scripts/build-assistant-taxonomy.mjs')], check=True)
