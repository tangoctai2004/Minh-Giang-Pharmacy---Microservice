// Dropdown Menu Handler
document.addEventListener('DOMContentLoaded', function() {
    const navItems = document.querySelectorAll('.nav-item');
    const dropdowns = document.querySelectorAll('.dropdown-menu');
    let scrollTimeout;

    // Handle hover to show/hide dropdown and center it
    navItems.forEach((item, index) => {
        item.addEventListener('mouseenter', function() {
            // Hide all dropdowns first
            dropdowns.forEach(dropdown => {
                dropdown.style.opacity = '0';
                dropdown.style.visibility = 'hidden';
            });

            // Show current dropdown
            const dropdown = item.querySelector('.dropdown-menu');
            if (dropdown) {
                dropdown.style.opacity = '1';
                dropdown.style.visibility = 'visible';
                dropdown.style.translate = '0 0';
                centerDropdown(dropdown);
            }
        });

        item.addEventListener('mouseleave', function() {
            const dropdown = item.querySelector('.dropdown-menu');
            if (dropdown) {
                dropdown.style.opacity = '0';
                dropdown.style.visibility = 'hidden';
                dropdown.style.translate = '0 -10px';
            }
        });
    });

    // Center dropdown on window resize
    window.addEventListener('resize', function() {
        const visibleDropdown = document.querySelector('.dropdown-menu[style*="visibility: visible"]');
        if (visibleDropdown) {
            centerDropdown(visibleDropdown);
        }
    });

    // Hide dropdown on scroll
    document.addEventListener('scroll', function() {
        dropdowns.forEach(dropdown => {
            dropdown.style.opacity = '0';
            dropdown.style.visibility = 'hidden';
            dropdown.style.translate = '0 -10px';
        });

        // Clear existing timeout
        clearTimeout(scrollTimeout);
        
        // Re-enable dropdown after scroll ends (300ms)
        scrollTimeout = setTimeout(function() {
            // Dropdown will show again on next hover
        }, 300);
    });

    // Function to center dropdown
    function centerDropdown(dropdown) {
        const viewportWidth = window.innerWidth;
        const dropdownWidth = Math.min(1200, viewportWidth);
        const leftPosition = (viewportWidth - dropdownWidth) / 2;
        
        // Set dropdown position to be centered
        dropdown.style.position = 'fixed';
        dropdown.style.left = leftPosition + 'px';
        dropdown.style.width = dropdownWidth + 'px';
        
        // Get navbar position to place dropdown right below it
        const navbar = document.querySelector('.main-nav');
        if (navbar) {
            const navbarRect = navbar.getBoundingClientRect();
            dropdown.style.top = (navbarRect.bottom) + 'px';
        }
    }
});
