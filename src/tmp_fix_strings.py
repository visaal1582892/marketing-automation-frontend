import os

directory = '/home/developer/rohitworkspace/prod/marketing-automation/marketing-automation-frontend/src'

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith(('.js', '.jsx')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            if 'Manager QC' in content or 'Requestor QC' in content:
                new_content = content.replace('Manager QC', 'Marketing Review')
                new_content = new_content.replace('Requestor QC', 'Requestor Review')
                with open(filepath, 'w', encoding='utf-8', errors='ignore') as f:
                    f.write(new_content)
                print(f"Updated {filepath}")
