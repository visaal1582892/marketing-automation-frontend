import os

file_path = 'src/pages/manager/ManagerQcReviewPage.jsx'
with open(file_path, 'r') as f:
    lines = f.readlines()

# find line 796 which is the start of the duplicate block
# We know the content: `/** Top-up request section — per-state inputs with minimum = overrun */`
# and we know line 1116 is empty, line 1117 is `function ActionRadio`

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "/** Top-up request section — per-state inputs with minimum = overrun */" in line:
        start_idx = i - 1 # include the empty line above it
        break

if start_idx != -1:
    for i in range(start_idx, len(lines)):
        if "function ActionRadio" in lines[i]:
            end_idx = i
            break

if start_idx != -1 and end_idx != -1:
    # Delete the lines
    new_lines = lines[:start_idx] + lines[end_idx:]
    with open(file_path, 'w') as f:
        f.writelines(new_lines)
    print(f"Deleted lines {start_idx+1} to {end_idx}")
else:
    print(f"Could not find the block. start_idx: {start_idx}, end_idx: {end_idx}")
