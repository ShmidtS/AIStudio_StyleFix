// ==UserScript==
// @name         AI Studio Performance & Style Fix
// @namespace    http://tampermonkey.net/
// @version      3.0.0
// @description  Applies CSS optimizations for performance and style (chat layout, code blocks), blocks GTM, and removes the cookie banner for AI Studio. Focused version without deep analysis or configuration menu.
// @author       Generated AI & ShmidtS
// @match        https://aistudio.google.com/*
// @grant        GM_addStyle
// @run-at       document-start
// @noframes
// @license      MIT
// @updateURL    https://raw.githubusercontent.com/ShmidtS/AIStudio_StyleFix/main/AI_Studio_Performance_Style_Fix.user.js
// @downloadURL  https://raw.githubusercontent.com/ShmidtS/AIStudio_StyleFix/main/AI_Studio_Performance_Style_Fix.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- Constants ---
    const SCRIPT_VERSION = "3.0.0";
    const SCRIPT_NAME = "AI Studio Performance & Style Fix";

    // --- Configuration (Hardcoded - Modify here if needed) ---
    const CONFIG = {
        enableSmoothScroll: true,           // Плавная прокрутка чата
        aggressivelyDisableAnimations: true, // Отключить анимации/переходы для производительности
        optimizeCodeBlocks: true,           // Применить оптимизации к блокам кода
        disableGTM: true,                   // Блокировать Google Tag Manager
        removeCookieBanner: true,           // Удалить баннер cookie
        codeBlockMaxHeight: '70vh',         // Макс. высота блоков кода (или 'none')
        forceCodeBlockBasicStyle: false,    // Принудительно применить базовые стили к коду (для обхода проблем тем)
        forcedCodeBlockBackgroundColor: '#f0f0f0', // Фон для базового стиля
        forcedCodeBlockBorder: '1px solid #ccc',     // Граница для базового стиля
    };

    // --- Globals ---
    if (window.aiStudioPerfStyleFixExecuted) {
        console.log(`%c[${SCRIPT_NAME} v${SCRIPT_VERSION}]%c: Already executed. Skipping.`, 'color: purple; font-weight: bold;', 'color: orange;');
        return;
    }
    window.aiStudioPerfStyleFixExecuted = true;

    // --- Simple Logging Helper ---
    const log = {
        _log: (level, color, message) => {
            console.log(`%c[${SCRIPT_NAME}] ${level}:%c ${message}`, `color: ${color}; font-weight: bold;`, 'color: default;');
        },
        info: (message) => log._log('INFO', 'blue', message),
        warn: (message) => log._log('WARN', 'orange', message),
        error: (message, error = null) => {
            log._log('ERROR', 'red', message);
            if (error) console.error(error);
        },
        success: (message) => log._log('SUCCESS', 'green', message),
    };

    // --- Selectors ---
    const SELECTORS = {
        chatScrollContainer: 'ms-autoscroll-container',       // Контейнер прокрутки чата
        chatMessageItem: 'ms-chat-turn',                      // Элемент сообщения/хода
        codeBlock: 'ms-code-block pre, ms-response-part pre', // Блоки <pre> с кодом
        cookieBanner: '.glue-cookie-notification-bar',        // Баннер cookie
    };
    // --- End of Selectors ---


    // --- Core Logic ---

    /**
     * Attempts to disable Google Tag Manager by intercepting dataLayer.push.
     * Needs unsafeWindow grant, which might not always be available or desired.
     */
    function tryDisableGTM() {
        if (!CONFIG.disableGTM) return;

        // GTM blocking often requires unsafeWindow. Proceed cautiously.
        // If unsafeWindow is not granted or available, this part might fail silently
        // or need adjustment depending on the environment (e.g., Violentmonkey vs Tampermonkey).
        let targetWindow = window;
        try {
            // Check if unsafeWindow exists and use it if available
            if (typeof unsafeWindow !== 'undefined' && unsafeWindow.dataLayer) {
                 targetWindow = unsafeWindow;
                 log.info('Using unsafeWindow context for GTM blocking.');
            } else if (window.dataLayer) {
                 log.info('Using window context for GTM blocking (might be less reliable).');
            } else {
                 log.info('GTM dataLayer not found at execution time. Skipping block.');
                 return; // Exit if dataLayer isn't found initially
            }

            // Ensure dataLayer exists and push is a function before overriding
            if (targetWindow.dataLayer && typeof targetWindow.dataLayer.push === 'function') {
                let blockedCount = 0;
                const originalPush = targetWindow.dataLayer.push; // Keep original just in case

                targetWindow.dataLayer.push = function(...args) {
                    blockedCount++;
                    if (blockedCount <= 3) { // Log only the first few blocks
                        log.warn(`Blocked GTM dataLayer.push call #${blockedCount}.`);
                    } else if (blockedCount === 4) {
                        log.warn('Further GTM dataLayer.push blocks will not be logged.');
                    }
                    // Optionally, you could inspect args here and conditionally call originalPush
                    // For now, just block everything.
                    // return originalPush.apply(targetWindow.dataLayer, args); // To allow the call
                    return Array.isArray(targetWindow.dataLayer) ? targetWindow.dataLayer.length : 0; // Mimic original behavior
                };
                log.success('GTM dataLayer.push intercepted and blocked.');
            } else {
                 log.info('GTM dataLayer.push method not found or not a function.');
            }
        } catch (e) {
            log.error('Error occurred while trying to disable GTM. Granting unsafeWindow might be required.', e);
        }
    }

    /**
     * Applies CSS rules for performance optimization and styling overrides.
     */
    function applyCSSOptimizations() {
        const scrollContainerSelector = SELECTORS.chatScrollContainer;
        const messageItemSelector = SELECTORS.chatMessageItem;
        const codeBlockSelector = SELECTORS.codeBlock;

        log.info('Applying CSS optimizations...');

        let cssStyles = `/* --- ${SCRIPT_NAME} v${SCRIPT_VERSION} CSS --- */\n\n`;

        // Scroll Container CSS
        if (scrollContainerSelector) {
            cssStyles += `
/* ** Chat Scroll Container (${scrollContainerSelector}) ** */
.${scrollContainerSelector} {
    /* Изоляция рендеринга: layout (размер/позиция), paint (пиксели), style (вычисленные стили) */
    contain: layout paint style;
    /* Подсказка о возможных изменениях transform (например, scroll anchoring) */
    will-change: transform;
    /* Настраиваемое поведение прокрутки */
    scroll-behavior: ${CONFIG.enableSmoothScroll ? 'smooth' : 'auto'} !important;
    /* Стабилизация места для scrollbar для предотвращения сдвигов макета */
    scrollbar-gutter: stable both-edges;
}\n\n`;
        } else {
            log.warn('Chat Scroll Container selector not defined, skipping related CSS.');
        }

        // Chat Message Item CSS
        if (messageItemSelector) {
            cssStyles += `
/* ** Chat Message Item (${messageItemSelector}) ** */
.${messageItemSelector} {
    /* Изоляция отдельных сообщений */
    contain: content; /* 'layout paint style' */
    ${CONFIG.aggressivelyDisableAnimations ? `
    /* Принудительное отключение анимаций/переходов */
    transition: none !important;
    animation: none !important;
    animation-duration: 0s !important;
    transition-duration: 0s !important;` : ''}
}\n\n`;
        } else {
            log.warn('Chat Message Item selector not defined, skipping related CSS.');
        }

        // Code Block CSS
        if (CONFIG.optimizeCodeBlocks && codeBlockSelector) {
            cssStyles += `
/* ** Code Block (${codeBlockSelector}) Optimizations ** */
${codeBlockSelector} {
    /* Изоляция блоков кода */
    contain: layout style paint;
    /* Обеспечение прокрутки */
    overflow: auto !important;
    /* Настраиваемая максимальная высота */
    ${CONFIG.codeBlockMaxHeight && CONFIG.codeBlockMaxHeight !== 'none' ? `max-height: ${CONFIG.codeBlockMaxHeight} !important;` : ''}
    /* Подсказка о возможных изменениях прокрутки */
    will-change: scroll-position;
    ${CONFIG.aggressivelyDisableAnimations ? `
    transition: none !important;
    animation: none !important;
    animation-duration: 0s !important;
    transition-duration: 0s !important;` : ''}
}\n\n`;

            // Forced Basic Style CSS (if enabled)
            if (CONFIG.forceCodeBlockBasicStyle) {
                cssStyles += `
/* ** Forced Basic Code Block Style ** */
${codeBlockSelector} {
    background-color: ${CONFIG.forcedCodeBlockBackgroundColor} !important;
    border: ${CONFIG.forcedCodeBlockBorder} !important;
    padding: 0.8em 1em !important;
    color: #333 !important; /* Обеспечение контраста */
    font-family: monospace !important;
    font-size: 0.9em !important;
    white-space: pre-wrap !important; /* Обеспечение переноса строк */
    word-wrap: break-word !important;
}\n\n`;
            }
        } else if (CONFIG.optimizeCodeBlocks) {
            log.warn('Code Block selector not defined, skipping related CSS optimizations.');
        }
        // --- End CSS Generation ---


        // --- Applying CSS ---
        try {
            GM_addStyle(cssStyles);
            log.success('CSS optimizations applied successfully via GM_addStyle.');
        } catch (error) {
            log.error('Failed to apply CSS optimizations via GM_addStyle. Trying fallback <style> injection.', error);
            try {
                const styleElement = document.createElement('style');
                styleElement.id = 'ai-studio-perf-style-fix-styles-fallback';
                styleElement.textContent = cssStyles;
                // Append to head early, fallback to documentElement if head not ready
                (document.head || document.documentElement).appendChild(styleElement);
                log.warn('CSS optimizations applied via fallback <style> injection.');
            } catch (fallbackError) {
                log.error('Fallback CSS injection also failed. Styles may not be applied.', fallbackError);
            }
        }
    }

    /**
     * Uses MutationObserver to find and remove the cookie banner element.
     */
    function observeAndRemoveCookieBanner() {
        if (!CONFIG.removeCookieBanner || !SELECTORS.cookieBanner) {
            if (!SELECTORS.cookieBanner && CONFIG.removeCookieBanner) {
                 log.warn('Cookie banner selector not defined, cannot remove.');
            }
            return;
        }

        let bannerRemoved = false;
        let observer = null;

        const removeBanner = (bannerElement) => {
            if (!bannerElement || bannerRemoved) return false;
            try {
                bannerElement.remove();
                bannerRemoved = true;
                log.success('Cookie banner removed.');
                if (observer) {
                    observer.disconnect();
                    log.info('Cookie banner observer disconnected.');
                }
                return true;
            } catch (removeError) {
                log.error('Error removing cookie banner element.', removeError);
                if (observer) observer.disconnect();
                return false;
            }
        };

        // Try removing immediately (works if script runs after banner is added)
        try {
            const initialBanner = document.querySelector(SELECTORS.cookieBanner);
            if (initialBanner) {
                log.info('Cookie banner found on initial check.');
                if(removeBanner(initialBanner)) return;
            }
        } catch (e) {
            log.error('Error during initial cookie banner check.', e);
        }

        // If not found/removed, set up the observer (needed if banner loads dynamically)
        log.info('Setting up observer for cookie banner...');
        try {
            observer = new MutationObserver((mutationsList, obs) => {
                if (bannerRemoved) return;

                for (const mutation of mutationsList) {
                    if (mutation.addedNodes) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.matches && node.matches(SELECTORS.cookieBanner)) {
                                    if (removeBanner(node)) return;
                                } else if (node.querySelector) {
                                    try {
                                        const banner = node.querySelector(SELECTORS.cookieBanner);
                                        if (banner) {
                                            if (removeBanner(banner)) return;
                                        }
                                    } catch(qsError) { /* ignore */ }
                                }
                            }
                        }
                    }
                }
            });

            // Observe the documentElement as body might not be ready at document-start
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
            log.success('Cookie banner observer initialized.');

        } catch (e) {
            log.error('Failed to create MutationObserver for cookie banner.', e);
        }
    }


    // --- Initialization Sequence ---

    function initialize() {
        tryDisableGTM();
        applyCSSOptimizations();

        observeAndRemoveCookieBanner();
    }

    // --- Execute Initialization ---
    try {
        initialize();
    } catch (initError) {
        log.error('A critical error occurred during script initialization!', initError);
    }

})();