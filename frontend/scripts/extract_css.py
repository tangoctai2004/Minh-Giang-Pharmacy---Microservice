import os

fe_dir = '/Users/tangoctai/StudySpace/SOA.2026/Minh Giang Pharmacy/FE'
html_file = os.path.join(fe_dir, 'benh-chuyen-khoa.html')
css_file = os.path.join(fe_dir, 'style.css')

with open(html_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Lines 154 to 319 (0-indexed 153 to 319) in benh-chuyen-khoa.html
start_idx = 153 # Line 154
end_idx = 319 + 1 # Include line 320 which is </style>... wait, 320 is </style>. I don't want </style>
end_idx = 319 # Keep up to 319

extracted_css = ''.join(lines[start_idx:end_idx])

# Remove from html file
new_html_lines = lines[:start_idx] + lines[end_idx:]
with open(html_file, 'w', encoding='utf-8') as f:
    f.writelines(new_html_lines)

# Append to style.css
with open(css_file, 'a', encoding='utf-8') as f:
    f.write('\n/* Extracted Component Styles from benh-chuyen-khoa.html */\n')
    f.write(extracted_css)

print("CSS extracted and appended to style.css successfully.")
