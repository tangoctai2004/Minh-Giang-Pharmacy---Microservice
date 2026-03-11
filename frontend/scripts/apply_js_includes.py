import os
import re

fe_dir = '/Users/tangoctai/StudySpace/SOA.2026/Minh Giang Pharmacy/FE'
includes_dir = os.path.join(fe_dir, 'includes')

# 1. Rename .jsp to .html
for f in os.listdir(includes_dir):
    if f.endswith('.jsp'):
        os.rename(os.path.join(includes_dir, f), os.path.join(includes_dir, f.replace('.jsp', '.html')))

print("Renamed components to .html")

# 2. Update benh-chuyen-khoa.html
files_to_update = ['benh-chuyen-khoa.html', 'disease.html']
for filepath in files_to_update:
    full_path = os.path.join(fe_dir, filepath)
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace <%@include file="includes/filename.jsp" %> with <div id="mg-component-filename"></div>
    # Add an empty placeholder div instead of the jsp include
    content = re.sub(r'<%@include\s+file="includes/(.+?)\.jsp"\s*%>', r'<div mg-include="includes/\1.html"></div>', content)
    
    # Check if components.js is already included, if not add it before </body>
    if '<script src="components.js"></script>' not in content:
        content = content.replace('</body>', '    <script src="components.js"></script>\n</body>')
        
    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Updated HTML files to use components.js client-side includes")
