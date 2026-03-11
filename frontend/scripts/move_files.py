import os
import shutil

def main():
    base_dir = '/Users/tangoctai/StudySpace/SOA.2026/Minh Giang Pharmacy/FE'
    os.chdir(base_dir)

    # 1. Create target directories
    dirs_to_create = [
        'admin/css', 'admin/js',
        'client',
        'pos/css',
        'assets_new/css', 'assets_new/js', 'assets_new/images', 'assets_new/design',
        'components',
        'scripts'
    ]
    for d in dirs_to_create:
        os.makedirs(d, exist_ok=True)

    # 2. Move Admin files
    if os.path.exists('admin/admin-style.css'):
        shutil.move('admin/admin-style.css', 'admin/css/admin-style.css')
    if os.path.exists('admin/admin-components.js'):
        shutil.move('admin/admin-components.js', 'admin/js/admin-components.js')
    
    # 3. Move POS files
    if os.path.exists('pos/pos-style.css'):
        shutil.move('pos/pos-style.css', 'pos/css/pos-style.css')

    # 4. Move Client files (all HTMLs from root and Web/)
    for item in os.listdir(base_dir):
        if item.endswith('.html') and os.path.isfile(item):
            shutil.move(item, os.path.join('client', item))
    
    if os.path.exists('Web'):
        for item in os.listdir('Web'):
            shutil.move(os.path.join('Web', item), os.path.join('client', item))
        shutil.rmtree('Web')

    # 5. Move Assets (style.css, components.js, and everything in assets/ and design/)
    if os.path.exists('style.css'):
        shutil.move('style.css', 'assets_new/css/style.css')
    if os.path.exists('components.js'):
        shutil.move('components.js', 'assets_new/js/components.js')
    
    if os.path.exists('assets'):
        for item in os.listdir('assets'):
            shutil.move(os.path.join('assets', item), os.path.join('assets_new/images', item))
        shutil.rmtree('assets')
        
    if os.path.exists('design'):
        for item in os.listdir('design'):
            shutil.move(os.path.join('design', item), os.path.join('assets_new/design', item))
        shutil.rmtree('design')
        
    # Rename assets_new to assets
    os.rename('assets_new', 'assets')

    # 6. Move Components
    if os.path.exists('includes'):
        for item in os.listdir('includes'):
            shutil.move(os.path.join('includes', item), os.path.join('components', item))
        shutil.rmtree('includes')
        
    # 7. Move Scripts
    for item in os.listdir(base_dir):
        if item.endswith('.py') and os.path.isfile(item):
            shutil.move(item, os.path.join('scripts', item))
    if os.path.exists('apply_jsp_includes.js'):
        shutil.move('apply_jsp_includes.js', os.path.join('scripts', 'apply_jsp_includes.js'))

    print("All files moved successfully.")

if __name__ == '__main__':
    main()
