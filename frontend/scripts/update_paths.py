import os
import re

def update_html_file(filepath, app_type):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if app_type == 'client':
        # Update css
        content = re.sub(r'href="(css/)?style\.css"', r'href="../assets/css/style.css"', content)
        # Update js
        content = re.sub(r'src="(js/)?components\.js"', r'src="../assets/js/components.js"', content)
        # Update images
        content = re.sub(r'(src|href)="assets/([^"]+)"', r'\1="../assets/images/\2"', content)
        # Update design
        content = re.sub(r'(src|href)="design/([^"]+)"', r'\1="../assets/design/\2"', content)
        # Update components (includes)
        content = re.sub(r'(src|href)="includes/([^"]+)"', r'\1="../components/\2"', content)
        # Web/ prefix
        content = re.sub(r'(src|href)="Web/([^"]+)"', r'\1="\2"', content)
    
    elif app_type == 'admin':
        # Admin paths
        content = re.sub(r'href="admin-style\.css"', r'href="css/admin-style.css"', content)
        content = re.sub(r'src="admin-components\.js"', r'src="js/admin-components.js"', content)
        content = re.sub(r'(src|href)="../assets/([^"]+)"', r'\1="../assets/images/\2"', content)
        content = re.sub(r'(src|href)="assets/([^"]+)"', r'\1="../assets/images/\2"', content)

    elif app_type == 'pos':
        content = re.sub(r'href="pos-style\.css"', r'href="css/pos-style.css"', content)
        content = re.sub(r'(src|href)="../assets/([^"]+)"', r'\1="../assets/images/\2"', content)
        content = re.sub(r'(src|href)="assets/([^"]+)"', r'\1="../assets/images/\2"', content)

    elif app_type == 'components':
        # inside components, references to assets are ../assets/images/
        content = re.sub(r'(src|href)="assets/([^"]+)"', r'\1="../assets/images/\2"', content)
        content = re.sub(r'(src|href)="../assets/([^"]+)"', r'\1="../assets/images/\2"', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def main():
    base_dir = '/Users/tangoctai/StudySpace/SOA.2026/Minh Giang Pharmacy/FE'
    
    dirs_to_process = {
        'client': 'client',
        'admin': 'admin',
        'pos': 'pos',
        'components': 'components'
    }
    
    for app_type, folder in dirs_to_process.items():
        folder_path = os.path.join(base_dir, folder)
        if not os.path.exists(folder_path):
            continue
        for root, _, files in os.walk(folder_path):
            for file in files:
                if file.endswith('.html'):
                    update_html_file(os.path.join(root, file), app_type)
    print("Paths updated successfully.")

if __name__ == '__main__':
    main()
