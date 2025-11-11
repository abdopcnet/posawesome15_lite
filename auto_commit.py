#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auto commit script for posawesome.
Updates version in __init__.py before committing.
"""

import os
import subprocess
from datetime import datetime

# Emojis by extension (based on actual files in the app)
EMOJI = {
    # Code files
    '.py': '🐍',
    '.js': '🔄',
    '.vue': '💄',

    # Configuration & Data
    '.json': '📋',
    '.txt': '📄',
    '.md': '📝',

    # Styling
    '.css': '🎨',

    # Web
    '.html': '🌐',

    # Images
    '.png': '🖼️',

    # Fonts
    '.woff': '🔤',
    '.woff2': '🔤',
    '.ttf': '🔤',
    '.eot': '🔤',

    # Build & Config files
    '.gitignore': '🚫',
    '.prettierrc': '✨',
    '.in': '📦',
    '.lock': '🔒',
    '.map': '🗺️',

    # Logs
    '.log': '📜',
}

# Get current date in DD.MM.YYYY format (no leading zeros)


def get_version_date():
    """Get current date formatted as version (DD.MM.YYYY, no leading zeros)."""
    now = datetime.now()
    day = now.day  # No leading zero
    month = now.month  # No leading zero
    year = now.year
    return f"{day}.{month}.{year}"

# Update version in __init__.py


def update_version():
    """Update __version__ in posawesome/__init__.py and README.md."""
    base_dir = os.path.dirname(__file__)
    init_file = os.path.join(base_dir, "posawesome", "__init__.py")
    readme_file = os.path.join(base_dir, "README.md")

    # Get new version
    new_version = get_version_date()

    # Update __init__.py
    if not os.path.exists(init_file):
        print(f"Warning: {init_file} not found")
    else:
        # Read current file
        with open(init_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Update version
        updated_content = f'__version__ = "{new_version}"'

        # Replace version line
        lines = content.split('\n')
        updated_lines = []
        version_found = False

        for line in lines:
            if line.strip().startswith('__version__'):
                updated_lines.append(updated_content)
                version_found = True
            else:
                updated_lines.append(line)

        # If version not found, add it
        if not version_found:
            updated_lines.append(updated_content)

        # Write updated content
        with open(init_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(updated_lines))

        print(f"✓ Updated __init__.py version to: {new_version}")

    # Update README.md badge
    if not os.path.exists(readme_file):
        print(f"Warning: {readme_file} not found")
    else:
        # Read current file
        with open(readme_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Update version badge
        import re
        # Pattern to match version badge: ![Version](...version-0.0.1-blue)
        pattern = r'!\[Version\]\(https://img\.shields\.io/badge/version-[^)]+\)'
        replacement = f'![Version](https://img.shields.io/badge/version-{new_version}-blue)'

        updated_content = re.sub(pattern, replacement, content)

        # Write updated content
        with open(readme_file, 'w', encoding='utf-8') as f:
            f.write(updated_content)

        print(f"✓ Updated README.md version badge to: {new_version}")

    return True


# Main execution
if __name__ == "__main__":
    # Update version first
    update_version()

    # Continue with git operations
    os.chdir(os.path.dirname(__file__))

    # Get changed files
    files = subprocess.getoutput("git status --short").strip().split('\n')
    files = [f.split()[1] for f in files if f.strip()]

    if not files:
        print("✅ No changes")
        exit()

    # Commit each file
    for f in files:
        ext = f[f.rfind('.'):] if '.' in f else ''
        emoji = EMOJI.get(ext, '📄')
        filename = f.split('/')[-1]  # Get only filename without path
        subprocess.run(f"git add {f}", shell=True)
        subprocess.run(f'git commit -m "{emoji} {filename}"', shell=True)

    # Check if no more changes, then push
    if not subprocess.getoutput("git status --porcelain"):
        subprocess.run("git push origin main", shell=True)
        print("✅ Done")
