/**
 * CSP-Safe Initialization Script
 * Handles:
 * 1. Font/stylesheet preload onload handlers
 * 2. Event listener attachments for lazy loading
 * 
 * This replaces all inline scripts/handlers to be CSP-compliant
 */

(function() {
    'use strict';

    // Stylesheet lazy-load handler (replaces onload="this.media='all'")
    // This loads stylesheets asynchronously and switches media from print to all after load
    function attachStylesheetHandlers() {
        const stylesheets = document.querySelectorAll('link[rel="stylesheet"][media="print"]');
        
        stylesheets.forEach(link => {
            if (!link.hasAttribute('onload-handled')) {
                link.addEventListener('load', function() {
                    this.media = 'all';
                }, { once: true });
                
                // Mark as handled to avoid duplicate listeners
                link.setAttribute('onload-handled', 'true');
            }
        });
    }

    // Font stylesheet lazy-load handler
    function attachFontHandlers() {
        const fontLinks = document.querySelectorAll('link[href*="fonts.googleapis.com"][media="print"]');
        
        fontLinks.forEach(link => {
            if (!link.hasAttribute('onload-handled')) {
                link.addEventListener('load', function() {
                    this.media = 'all';
                }, { once: true });
                
                link.setAttribute('onload-handled', 'true');
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            attachStylesheetHandlers();
            attachFontHandlers();
        });
    } else {
        // DOM already loaded
        attachStylesheetHandlers();
        attachFontHandlers();
    }

    // Mutation observer to handle dynamically added stylesheets
    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1 && node.tagName === 'LINK' && node.rel === 'stylesheet') {
                            if (node.media === 'print' && !node.hasAttribute('onload-handled')) {
                                node.addEventListener('load', function() {
                                    this.media = 'all';
                                }, { once: true });
                                node.setAttribute('onload-handled', 'true');
                            }
                        }
                    });
                }
            });
        });

        observer.observe(document.head, {
            childList: true,
            subtree: false
        });
    }
})();
