/**
 * components.js
 * Script to load reusable HTML components (Header, Footer, etc.) dynamically.
 * This allows previewing in VS Code Live Server without a backend.
 */

document.addEventListener("DOMContentLoaded", function () {
    const includes = document.querySelectorAll("[mg-include]");

    includes.forEach(async (el) => {
        const file = el.getAttribute("mg-include");
        if (file) {
            try {
                const response = await fetch(file);
                if (response.ok) {
                    let html = await response.text();
                    // Strip Live Server injected script from the HTML component
                    html = html.replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/gi, '');
                    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                    el.outerHTML = html; // Replace the placeholder entirely with the fetched HTML
                } else {
                    console.error("Error loading component:", file, response.statusText);
                    el.innerHTML = "Component not found.";
                }
            } catch (error) {
                console.error("Fetch error for component:", file, error);
                el.innerHTML = "Error loading component.";
            }
        }
    });
});
