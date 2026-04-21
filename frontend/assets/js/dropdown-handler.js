/**
 * Dropdown Menu Handler
 * Handles the visibility of the mega menu dropdowns.
 * We rely on CSS for positioning (position: absolute; left: 50%; transform: translateX(-50%))
 * to ensure the UI remains exactly as originally designed.
 */

function initDropdownHandler() {
    const navList = document.querySelector('.nav-list');
    if (!navList) return;

    // Use Event Delegation to handle dynamic .nav-item elements
    
    // Mouse Enter
    navList.addEventListener('mouseover', (e) => {
        const navItem = e.target.closest('.nav-item');
        if (!navItem) return;

        const dropdown = navItem.querySelector('.dropdown-menu');
        if (dropdown) {
            // We set opacity and visibility, but let CSS handle the position and transform
            dropdown.style.opacity = '1';
            dropdown.style.visibility = 'visible';
            dropdown.style.translate = '0 0';
            
            // If the original UI used fixed positioning, we can re-enable it.
            // However, the user reports displacement (lệch), which usually happens 
            // when JS fights with CSS. We attempt to let CSS handle it first.
        }
    });

    // Mouse Leave
    navList.addEventListener('mouseout', (e) => {
        const navItem = e.target.closest('.nav-item');
        if (!navItem) return;

        if (!navItem.contains(e.relatedTarget)) {
            const dropdown = navItem.querySelector('.dropdown-menu');
            if (dropdown) {
                dropdown.style.opacity = '0';
                dropdown.style.visibility = 'hidden';
                dropdown.style.translate = '0 -10px';
            }
        }
    });
}

// Initial run
document.addEventListener('DOMContentLoaded', initDropdownHandler);

// Expose to window
window.initDropdownHandler = initDropdownHandler;
