// ==UserScript==
// @name         AI Studio Performance Improver
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @description  Applies CSS optimizations, blocks GTM, removes cookie banner, and adds basic performance logging to help diagnose hangs in AI Studio.
// @author       Generated AI & ShmidtS
// @match        https://aistudio.google.com/*
// @grant        GM_addStyle
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// @license      MIT
// @updateURL    https://example.com/path/to/your/script/update/url.meta.js
// @downloadURL  https://example.com/path/to/your/script/download/url.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    // Настройте поведение скрипта здесь
    const CONFIG = {
        // --- General Performance ---
        enableSmoothScroll: true,              // Включает плавную прокрутку CSS для основного контейнера чата.
        enableContentVisibility: false,        // ЭКСПЕРИМЕНТАЛЬНО: Использовать 'content-visibility: auto' для сообщений чата.
                                               // Может улучшить рендеринг, но может вызвать сдвиги макета или проблемы с поиском на странице. Тщательно протестируйте!
        contentVisibilityPlaceholderSize: 'auto 200px', // Приблизительный размер плейсхолдера для content-visibility (ширина авто, высота 200px). Настройте, если enableContentVisibility = true.
        aggressivelyDisableAnimations: true,   // Агрессивно отключает CSS переходы/анимации в сообщениях чата и кодовых блоках.
                                               // Может улучшить производительность, но убирает визуальные эффекты.

        // --- Code Block Optimizations ---
        optimizeCodeBlocks: true,              // Применяет оптимизации к блокам кода (<pre>) для уменьшения "jank"/перерасчета макета.
        codeBlockMaxHeight: '70vh',            // Устанавливает максимальную высоту для блоков кода ('60vh', '500px' и т.д.). Используйте 'none' для отключения.
        forceCodeBlockBasicStyle: false,       // Принудительно применяет базовый фон/рамку к <pre>, если стили "исчезают" из-за других правил или проблем с таймингами.
        forcedCodeBlockBackgroundColor: '#f0f0f0', // Цвет фона для принудительного стиля.
        forcedCodeBlockBorder: '1px solid #ccc',   // Рамка для принудительного стиля.

        // --- Other ---
        disableGTM: true,                      // Пытается отключить Google Tag Manager (GTM), чтобы уменьшить фоновую активность и потенциальный сбор данных.
        removeCookieBanner: true,              // Удаляет нижний баннер согласия с куки.

        // --- Performance Analysis ---
        enablePerformanceAnalysis: true,       // Включает базовое профилирование и логирование узких мест.
        logLongTasks: true,                    // Логирует "длинные задачи", которые могут блокировать основной поток (> 50ms).
        longTaskThreshold: 50,                 // Порог в миллисекундах для определения "длинной задачи".
        logPerformanceMarks: true,             // Логирует основные этапы выполнения скрипта (start, CSS applied, DOM ready и т.д.).
        logFunctionExecutionTime: true,        // Логирует время выполнения ключевых функций скрипта.
    };
    // --- End of Configuration ---

    const SCRIPT_VERSION = "2.1.0";
    const SCRIPT_NAME = "AI Studio Performance Improver";

    // Предотвращение многократного выполнения
    if (window.aiStudioPerfImproverExecuted) {
        console.log(`%c[${SCRIPT_NAME} v${SCRIPT_VERSION}]%c: Already executed. Skipping.`, 'color: purple; font-weight: bold;', 'color: orange;');
        return;
    }
    window.aiStudioPerfImproverExecuted = true;

    // --- Helper Functions ---
    function log(message, color = 'blue', details = null) {
        const prefix = `%c[${SCRIPT_NAME}]%c`;
        const style = `color: ${color}; font-weight: bold;`;
        // Только выводим детали, если они не null и не undefined
        if (details !== null && details !== undefined) {
            console.log(prefix + `: ${message}`, style, 'color: default;', details);
        } else {
            console.log(prefix + `: ${message}`, style, 'color: default;');
        }
    }

    function errorLog(message, error = null) {
        const prefix = `%c[${SCRIPT_NAME}] ERROR:%c`;
        if (error) {
            console.error(prefix, 'color: red; font-weight: bold;', 'color: default;', message, error);
        } else {
            console.error(prefix, 'color: red; font-weight: bold;', 'color: default;', message);
        }
    }

    // --- Performance Analysis Helpers ---
    let performanceObserver = null;

    /** Отмечает точку во времени для анализа производительности */
    function markPerf(label) {
        if (!CONFIG.enablePerformanceAnalysis || !CONFIG.logPerformanceMarks) return;
        try {
            performance.mark(label);
            // log(`Perf Mark: ${label}`, 'teal'); // Можно раскомментировать для подробного лога
        } catch (e) {
            errorLog(`Failed to create performance mark "${label}"`, e);
        }
    }

    /** Измеряет и логирует время выполнения функции */
    function measureExecutionTime(label, taskFn) {
        if (!CONFIG.enablePerformanceAnalysis || !CONFIG.logFunctionExecutionTime) {
            // Все равно выполняем задачу, если логирование отключено
            return taskFn();
        }

        const startMark = `start_${label}_${performance.now()}`;
        const endMark = `end_${label}_${performance.now()}`;
        markPerf(startMark);
        let result;
        try {
            result = taskFn(); // Выполняем исходную функцию
        } finally { // Гарантируем, что измерение произойдет даже при ошибке в taskFn
             markPerf(endMark);
             try {
                 performance.measure(label, startMark, endMark);
                 const measure = performance.getEntriesByName(label, "measure")[0];
                 if (measure) {
                     log(`Execution Time - ${label}: ${measure.duration.toFixed(2)} ms`, 'teal');
                 }
                 // Очистка меток, чтобы не засорять performance entries
                 performance.clearMarks(startMark);
                 performance.clearMarks(endMark);
                 performance.clearMeasures(label);
             } catch (e) {
                 errorLog(`Failed to measure or log execution time for "${label}"`, e);
             }
        }
        return result;
    }

    /** Настраивает PerformanceObserver для отслеживания длинных задач */
    function setupLongTaskObserver() {
        if (!CONFIG.enablePerformanceAnalysis || !CONFIG.logLongTasks || !('PerformanceObserver' in window)) {
            if (CONFIG.enablePerformanceAnalysis && CONFIG.logLongTasks) {
                 log('Long Task Observer skipped: PerformanceObserver API not supported or disabled.', 'orange');
            }
            return;
        }

        try {
            performanceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    // Логируем задачи, превышающие порог
                    if (entry.duration > CONFIG.longTaskThreshold) {
                         log(`Long Task Detected: ${entry.duration.toFixed(2)} ms`, 'orange', {
                            name: entry.name,
                            startTime: entry.startTime.toFixed(2),
                            duration: entry.duration.toFixed(2),
                            attribution: entry.attribution // Показывает контекст (скрипт, событие и т.д.), если доступно
                         });
                    }
                }
            });

            // Начинаем наблюдение за 'longtask'
            performanceObserver.observe({ type: 'longtask', buffered: true });
            log('PerformanceObserver started for long task detection.', 'teal');

        } catch (error) {
            errorLog('Failed to set up PerformanceObserver for long tasks.', error);
            performanceObserver = null; // Сбрасываем, если настройка не удалась
        }
    }

    /** Останавливает PerformanceObserver */
    function disconnectPerformanceObserver() {
        if (performanceObserver) {
            performanceObserver.disconnect();
            performanceObserver = null;
            log('PerformanceObserver disconnected.', 'grey');
        }
    }

    // --- Initial Log & Setup ---
    markPerf('Script_Start');
    log(`Initializing v${SCRIPT_VERSION}. Config loaded:`, 'purple');
    console.log("CONFIG:", CONFIG); // Выводим весь конфиг для отладки
    if (CONFIG.enablePerformanceAnalysis) {
        setupLongTaskObserver(); // Начинаем слушать длинные задачи как можно раньше
    }
    // --- End Initial Log ---


    // --- Selectors ---
    // (Остаются те же, что и в предыдущей версии)
    const SELECTORS = {
        chatScrollContainer: 'ms-autoscroll-container',
        chatMessageItem: 'ms-chat-turn',
        get codeBlock() { return `${this.chatMessageItem} pre`; },
        cookieBanner: '.glue-cookie-notification-bar',
    };
    // --- End of Selectors ---

    // --- Core Logic ---

    /**
     * Пытается отключить Google Tag Manager (GTM).
     * (Логика немного улучшена для проверки существования dataLayer.push)
     */
    function tryDisableGTM() {
        return measureExecutionTime('Disable_GTM', () => {
            if (!CONFIG.disableGTM) {
                log('GTM disabling is turned off in config.', 'grey');
                return;
            }
            try {
                // Проверяем доступность unsafeWindow и dataLayer
                if (typeof unsafeWindow === 'undefined') {
                     errorLog('unsafeWindow is not available. Cannot reliably disable GTM.');
                     return;
                }
                unsafeWindow.dataLayer = unsafeWindow.dataLayer || [];

                // Проверяем, что dataLayer.push существует и является функцией перед переопределением
                if (typeof unsafeWindow.dataLayer.push === 'function') {
                    let blockCount = 0;
                    const maxLogCount = 5;

                    unsafeWindow.dataLayer.push = function(...args) {
                        blockCount++;
                        if (blockCount === maxLogCount) {
                            log(`Blocked GTM push #${blockCount}. Further blocks will not be logged individually.`, 'grey');
                        } else if (blockCount < maxLogCount) {
                            // log(`Blocked GTM push #${blockCount}. Args:`, 'grey', args); // Детальный лог (может быть многословно)
                        }
                        // Ничего не возвращаем и не выполняем
                    };
                    log('dataLayer.push overridden to block GTM execution.', 'green');
                } else {
                     log('unsafeWindow.dataLayer.push is not a function or doesnt exist. Skipping override.', 'orange');
                }


                // Слушатель ошибок загрузки GTM (улучшенная очистка)
                const gtmErrorListener = function(event) {
                    if (event.target?.src?.includes('googletagmanager.com/gtm.js')) {
                        log('Detected error related to GTM script loading (might be blocked, network issue, etc.).', 'orange');
                        // Удаляем себя после первого обнаружения
                        window.removeEventListener('error', gtmErrorListener, true); // Используем capture: true
                        // Также удаляем таймаут, если он был установлен
                        clearTimeout(gtmListenerTimeoutId);
                    }
                };

                // Устанавливаем таймаут для автоматического удаления слушателя, если GTM не загрузился/не вызвал ошибку
                const gtmListenerTimeoutId = setTimeout(() => {
                    window.removeEventListener('error', gtmErrorListener, true);
                    log('GTM error listener removed via timeout (GTM likely did not attempt to load or error out).', 'grey');
                }, 15000); // 15 секунд

                window.addEventListener('error', gtmErrorListener, { capture: true }); // Наблюдаем на стадии capture

            } catch (error) {
                errorLog('Failed to disable GTM via dataLayer override. GTM might still run.', error);
            }
        });
    }

    /**
     * Применяет CSS-правила для оптимизации.
     * (Логика без изменений, добавлено измерение времени)
     */
    function applyCSSOptimizations() {
         return measureExecutionTime('Apply_CSS_Optimizations', () => {
            let cssStyles = `
/* --- ${SCRIPT_NAME} v${SCRIPT_VERSION} CSS Optimizations --- */

/* ** Chat Scroll Container ** */
/* Isolate layout/paint/style recalculations. Avoid 'size' containment. Add scrollbar gutter. */
.${SELECTORS.chatScrollContainer} {
    contain: layout paint style;
    will-change: transform; /* Hint for scroll optimization */
    scroll-behavior: ${CONFIG.enableSmoothScroll ? 'smooth' : 'auto'} !important;
    scrollbar-gutter: stable both-edges;
}

/* ** Chat Message Item ** */
/* Isolate rendering. Optionally disable animations/transitions. Optionally use content-visibility. */
.${SELECTORS.chatMessageItem} {
    contain: content; /* Equivalent to layout paint */
    ${CONFIG.aggressivelyDisableAnimations ? `
    transition: none !important;
    animation: none !important;
    ` : ''}
    ${CONFIG.enableContentVisibility ? `
    /* EXPERIMENTAL: Test carefully for layout shifts or find-in-page issues */
    content-visibility: auto;
    contain-intrinsic-size: ${CONFIG.contentVisibilityPlaceholderSize};
    ` : ''}
}
`;
            if (CONFIG.optimizeCodeBlocks) {
                cssStyles += `
/* ** Code Block (<pre>) Optimizations ** */
/* Isolate rendering. Ensure overflow handling. Set max-height. Hint for internal scroll. */
${SELECTORS.codeBlock} {
    contain: layout style paint;
    overflow: auto !important;
    max-height: ${CONFIG.codeBlockMaxHeight && CONFIG.codeBlockMaxHeight !== 'none' ? CONFIG.codeBlockMaxHeight : 'none'} !important;
    will-change: scroll-position; /* Hint for internal scroll optimization */
    ${CONFIG.aggressivelyDisableAnimations ? `
    transition: none !important;
    animation: none !important;
    ` : ''}
    /* overflow-anchor: none; */ /* Kept commented: might prevent desired scroll anchoring *within* the block */
}
`;
                if (CONFIG.forceCodeBlockBasicStyle) {
                    cssStyles += `
/* ** Forced Basic Code Block Style (Fallback) ** */
${SELECTORS.codeBlock} {
    background-color: ${CONFIG.forcedCodeBlockBackgroundColor} !important;
    border: ${CONFIG.forcedCodeBlockBorder} !important;
    /* padding: 1em !important; */
    /* color: #333 !important; */
}
`;
                }
            }

            // Применяем стили
            try {
                GM_addStyle(cssStyles);
                log('CSS optimizations applied using GM_addStyle.', 'green');
                markPerf('CSS_Applied_GM');
            } catch (error) {
                errorLog('Failed to apply CSS optimizations via GM_addStyle. Trying fallback.', error);
                try {
                    const styleElement = document.createElement('style');
                    styleElement.id = 'ai-studio-perf-improver-styles-fallback';
                    styleElement.textContent = cssStyles;
                    (document.head || document.documentElement).appendChild(styleElement);
                    log('CSS optimizations applied via fallback <style> element injection.', 'orange');
                    markPerf('CSS_Applied_Fallback');
                } catch (fallbackError) {
                    errorLog('Fallback CSS injection also failed. Styles may not be applied.', fallbackError);
                    markPerf('CSS_Apply_Failed');
                }
            }
        });
    }

    /**
     * Использует MutationObserver для удаления баннера куки.
     * (Логика без изменений, добавлено измерение времени)
     */
    function observeAndRemoveCookieBanner() {
        return measureExecutionTime('Setup_Cookie_Banner_Observer', () => {
            if (!CONFIG.removeCookieBanner) {
                log('Cookie banner removal is turned off in config.', 'grey');
                return;
            }

            let observer = null;
            let bannerRemoved = false;
            let observerDisconnected = false; // Отслеживаем отключение
            let fallbackTimeoutId = null;
            let disconnectTimeoutId = null;

            // Функция удаления
            const removeBanner = (bannerElement) => {
                 measureExecutionTime('Remove_Cookie_Banner', () => {
                     if (bannerElement && !bannerRemoved) {
                        bannerElement.remove();
                        document.body.classList.remove('glue-cookie-notification-bar-visible');
                        document.documentElement.classList.remove('glue-cookie-notification-bar-visible');
                        bannerRemoved = true;
                        log('Cookie banner removed.', 'green');
                        markPerf('CookieBanner_Removed');
                        // Отключаем наблюдатель и таймауты
                        if (observer && !observerDisconnected) {
                             observer.disconnect();
                             observerDisconnected = true;
                             log('MutationObserver disconnected after removing banner.', 'grey');
                        }
                        clearTimeout(fallbackTimeoutId); // Отменяем fallback проверку
                        clearTimeout(disconnectTimeoutId); // Отменяем таймаут отключения наблюдателя
                        return true;
                    }
                    return false;
                 });
            };

            // Наблюдатель
            try {
                observer = new MutationObserver((mutationsList, obs) => {
                    if (bannerRemoved || observerDisconnected) {
                        if (obs && !observerDisconnected) {
                            obs.disconnect(); // Убедимся, что отключен
                            observerDisconnected = true;
                            log('MutationObserver disconnected (already removed/disconnected state).', 'grey');
                        }
                        return;
                    }
                    // Проверяем наличие баннера в DOM
                    const banner = document.querySelector(SELECTORS.cookieBanner);
                    if (banner) {
                        removeBanner(banner);
                        // Не нужно отключать здесь, removeBanner() это сделает
                    }
                });

                observer.observe(document.documentElement, { childList: true, subtree: true });
                log('MutationObserver started for cookie banner detection.', 'grey');
                markPerf('CookieBanner_Observer_Started');

                // Fallback проверка
                fallbackTimeoutId = setTimeout(() => {
                    if (!bannerRemoved) {
                        const banner = document.querySelector(SELECTORS.cookieBanner);
                        if (banner) {
                           removeBanner(banner);
                        } else {
                            log('Cookie banner not found by observer or fallback check.', 'grey');
                            // Устанавливаем таймаут для отключения наблюдателя, если баннер так и не появился
                            if (observer && !observerDisconnected) {
                                disconnectTimeoutId = setTimeout(() => {
                                    if (!bannerRemoved && observer && !observerDisconnected) { // Доп. проверка
                                        observer.disconnect();
                                        observerDisconnected = true;
                                        log('Observer disconnected via timeout (banner likely never appeared).', 'grey');
                                        markPerf('CookieBanner_Observer_Timeout');
                                    }
                                }, 5000); // Отключаем через 5 сек после fallback-а
                            }
                        }
                    }
                }, 750); // Задержка

            } catch (error) {
                errorLog('Failed to set up MutationObserver for cookie banner removal.', error);
                markPerf('CookieBanner_Observer_Failed');
                // Последняя попытка
                if (!bannerRemoved) {
                    const banner = document.querySelector(SELECTORS.cookieBanner);
                    if (banner) {
                       removeBanner(banner);
                       log('Removed cookie banner via direct call after observer setup error.', 'orange');
                    }
                }
            }
        });
    }


    // --- Порядок выполнения ---
    // Запускается на document-start
    try {
        // 1. Блокировка GTM (немедленно)
        tryDisableGTM();
        markPerf('GTM_Check_Complete');

        // 2. Применение CSS (немедленно)
        applyCSSOptimizations();
        markPerf('CSS_Check_Complete'); // Отметка после завершения функции (включая fallback)

        // 3. Задачи, требующие DOM
        function onDOMContentLoaded() {
            markPerf('DOMContentLoaded_Fired');
            log('DOMContentLoaded event fired.', 'grey');
            // Запускаем наблюдение за баннером куки
            observeAndRemoveCookieBanner();
            markPerf('Post_DOM_Tasks_Scheduled');
            // Можно добавить сюда другие задачи, которые должны выполняться после загрузки DOM
        }

        // Проверяем состояние DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
        } else {
            log('DOM already loaded or interactive, running post-load tasks immediately.', 'grey');
            onDOMContentLoaded(); // Выполняем сразу
        }

        // Добавляем слушатель на 'load' для финальной отметки и возможной очистки
        window.addEventListener('load', () => {
             markPerf('Window_Load_Fired');
             log('Window load event fired.', 'grey');
             // Отключаем PerformanceObserver, если он еще работает,
             // чтобы не собирать данные после полной загрузки страницы (если не нужно)
             // disconnectPerformanceObserver(); // Раскомментируйте, если хотите остановить наблюдение после загрузки
        });

        log(`Initialization sequence complete. Performance analysis logs ${CONFIG.enablePerformanceAnalysis ? 'ENABLED' : 'DISABLED'}. Check console for details & potential long tasks.`, 'purple');
        markPerf('Script_Init_Complete');

    } catch (initError) {
        errorLog('A critical error occurred during script initialization.', initError);
        markPerf('Script_Init_Failed');
    }

})();