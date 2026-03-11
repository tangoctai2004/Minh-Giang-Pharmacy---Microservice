import os
import re

fe_dir = '/Users/tangoctai/StudySpace/SOA.2026/Minh Giang Pharmacy/FE'
files_to_update = ['index.html', 'category.html', 'product.html', 'khai-truong.html']

for filepath in files_to_update:
    full_path = os.path.join(fe_dir, filepath)
    if not os.path.exists(full_path):
        continue
        
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Header Replacements
    content = re.sub(r'<!-- Header Banner -->.*?<!-- Top Bar -->', '<!-- Header Banner -->\n    <div mg-include="includes/header_banner.html"></div>\n\n    <!-- Top Bar -->', content, flags=re.DOTALL)
    content = re.sub(r'<!-- Top Bar -->.*?<!-- Main Header -->', '<!-- Top Bar -->\n    <div mg-include="includes/top_bar.html"></div>\n\n    <!-- Main Header -->', content, flags=re.DOTALL)
    content = re.sub(r'<!-- Main Header -->[\s\S]*?</header>', '<!-- Main Header -->\n    <div mg-include="includes/main_header.html"></div>', content)

    # 2. Footer Replacements (Pre-Footer Promises, Newsletter, Main Footer)
    content = re.sub(r'<!-- Pre-Footer Promises -->.*?<!-- Newsletter -->', '<!-- Pre-Footer Promises -->\n    <div mg-include="includes/promises.html"></div>\n\n    <!-- Newsletter -->', content, flags=re.DOTALL)
    content = re.sub(r'<!-- Newsletter -->.*?<!-- Main Footer -->', '<!-- Newsletter -->\n    <div mg-include="includes/newsletter.html"></div>\n\n    <!-- Main Footer -->', content, flags=re.DOTALL)
    content = re.sub(r'<!-- Main Footer -->[\s\S]*?</footer>', '<!-- Main Footer -->\n    <div mg-include="includes/main_footer.html"></div>', content)

    # 3. Add script tag before </body> if not present
    if '<script src="components.js"></script>' not in content:
        content = content.replace('</body>', '    <script src="components.js"></script>\n</body>')
        
    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Updated all remaining html files successfully")
