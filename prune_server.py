import os

file_path = r'e:\work\exam-website\server.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Indicies are 0-based. Line 215 is index 214.
# We want to keep lines 1 to 214 (indices 0 to 213).
# We want to skip lines 215 to 926 (indices 214 to 925).
# We want to keep lines 927 onwards (indices 926 onwards).

# Adjust if line numbers shifted due to previous edit.
# Previous edit added 2 lines at import (1 line -> 3 lines, +2 diff)
# And added 3 lines at mount (1 line -> 4 lines, +3 diff)
# Total shift: +5 lines.
# So original 215 is now roughly 220.

# SAFE APPROACH:
# Search for the start marker of the block to delete.
# Start Marker: "app.post('/api/submit/typing', authMiddleware, async (req, res) => {"
# End Marker: "app.get('/api/results/:sessionId', authMiddleware, async (req, res) => {" (This is the start of the NEXT block we want to keep)

start_marker = "app.post('/api/submit/typing', authMiddleware, async (req, res) => {"
end_marker = "app.get('/api/results/:sessionId', authMiddleware, async (req, res) => {"

new_lines = []
skip = False
found_start = False

for line in lines:
    if start_marker in line:
        skip = True
        found_start = True
    
    if end_marker in line:
        skip = False
    
    if not skip:
        new_lines.append(line)

if not found_start:
    print("Error: Could not find start marker.")
    exit(1)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Successfully removed code block.")
