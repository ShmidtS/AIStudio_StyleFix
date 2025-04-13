// ==UserScript==
// @name         AI Studio Performance & Style Fix
// @namespace    AI_Studio_Performance_Style_Fix
// @version      3.4.0
// @description  Применяет CSS оптимизации для производительности и стиля (макет чата, улучшенные блоки кода с внутренней прокруткой и кнопкой копирования), блокирует GTM и удаляет баннер cookie для AI Studio.
// @author       Generated AI, ShmidtS
// @match        https://aistudio.google.com/*
// @grant        GM_addStyle
// @grant        GM_info
// @run-at       document-start
// @noframes
// @license      MIT
// @updateURL    https://raw.githubusercontent.com/ShmidtS/AIStudio_StyleFix/main/AI_Studio_Performance_Style_Fix.user.js
// @downloadURL  https://raw.githubusercontent.com/ShmidtS/AIStudio_StyleFix/main/AI_Studio_Performance_Style_Fix.user.js
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_NAME = "AI Studio Performance & Style Fix";
    const SCRIPT_VERSION = "3.4.0";

    const CONFIG = {
        enableSmoothScroll: true,
        aggressivelyDisableAnimations: true,
        disableGTM: true,
        removeCookieBanner: true,
        optimizeCodeBlocks: true,
        codeBlockMaxHeight: '70vh',
        forceCodeBlockBasicStyle: false,
        forcedCodeBlockBackgroundColor: '#282c34',
        forcedCodeBlockBorder: '1px solid #555',
    };

    if (window.aiStudioPerfStyleFixExecuted_v3_4_0) {
        console.log(`%c[${SCRIPT_NAME} v${SCRIPT_VERSION}]%c: Уже выполнен. Пропускается.`, 'color: purple; font-weight: bold;', 'color: orange;');
        return;
    }
    window.aiStudioPerfStyleFixExecuted_v3_4_0 = true;

    const log = {
        _log: (level, color, message) => {
            if (typeof console === 'undefined') return;
            console.log(`%c[${SCRIPT_NAME} v${SCRIPT_VERSION}] ${level}:%c ${message}`, `color: ${color}; font-weight: bold;`, 'color: default;');
        },
        info: (message) => log._log('INFO', 'blue', message),
        warn: (message) => log._log('WARN', 'orange', message),
        error: (message, error = null) => {
            log._log('ERROR', 'red', message);
            if (error && typeof console.error === 'function') console.error(error);
        },
        success: (message) => log._log('SUCCESS', 'green', message),
    };

    // --- Селекторы ---
    const SELECTORS = {
        chatScrollContainer: 'ms-autoscroll-container',
        chatMessageItem: 'ms-chat-turn',

        codeBlockContainer: 'div.syntax-highlighted-code-wrapper',   // Внешний контейнер (ОБЕРТКА кода и футера)
        codeContentElement: 'div.syntax-highlighted-code',           // Внутренний элемент С КОДОМ (для прокрутки)
        copyButton: 'footer button[mattooltip*="Copy"]', // Кнопка копирования внутри футера блока кода

        cookieBanner: '.glue-cookie-notification-bar',
    };
    // --- Конец Селекторов ---

    function tryDisableGTM() {
        if (!CONFIG.disableGTM) return;
        log.info('Попытка блокировать Google Tag Manager...');
        let targetWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        let contextUsed = (typeof unsafeWindow !== 'undefined') ? 'unsafeWindow' : 'window';
        try {
            if (targetWindow.dataLayer && typeof targetWindow.dataLayer.push === 'function') {
                let blockedCount = 0;
                const originalPush = targetWindow.dataLayer.push;
                targetWindow.dataLayer.push = function(...args) {
                    blockedCount++;
                    if (blockedCount <= 3) { log.warn(`Заблокирован вызов GTM dataLayer.push #${blockedCount}.`); }
                    else if (blockedCount === 4) { log.warn('Дальнейшие блокировки GTM dataLayer.push не будут логироваться.'); }
                    return Array.isArray(targetWindow.dataLayer) ? targetWindow.dataLayer.length : 0;
                };
                log.success(`Перехват и блокировка GTM dataLayer.push выполнены (контекст: ${contextUsed}).`);
            } else {
                log.info(`GTM dataLayer или dataLayer.push не найдены в контексте ${contextUsed}.`);
            }
        } catch (e) {
            log.error(`Ошибка при попытке отключить GTM (контекст: ${contextUsed}).`, e);
        }
    }

    function injectStyleElement(css) {
        try {
            const style = document.createElement('style');
            style.id = `${SCRIPT_NAME.replace(/\s+/g, '-')}-styles-${SCRIPT_VERSION}`;
            style.type = 'text/css';
            style.textContent = css;
            (document.head || document.documentElement).appendChild(style);
            log.success('CSS стили успешно добавлены через элемент <style>.');
        } catch (error) {
            log.error('Не удалось добавить CSS через элемент <style>.', error);
        }
    }

    function applyCSSOptimizations() {
        const scrollContainerSelector = SELECTORS.chatScrollContainer;
        const messageItemSelector = SELECTORS.chatMessageItem;
        const codeContainerSelector = SELECTORS.codeBlockContainer;   // Внешняя обертка
        const codeContentSelector = SELECTORS.codeContentElement;     // Внутренний элемент с кодом (для прокрутки)
        const copyButtonSelector = SELECTORS.copyButton;
        const codeFooterSelector = `${codeContainerSelector} > footer`; // Селектор для футера внутри обертки

        log.info('Применение CSS оптимизаций с ИСПРАВЛЕННОЙ логикой для блоков кода...');
        if (!codeContainerSelector || !codeContentSelector || !copyButtonSelector) {
            log.warn('Один или несколько КЛЮЧЕВЫХ селекторов для блока кода НЕ ОПРЕДЕЛЕНЫ! Стили для кода могут не работать.');
        }

        let cssStyles = `/* --- ${SCRIPT_NAME} v${SCRIPT_VERSION} CSS (Исправлено) --- */\n\n`;

        // --- Контейнер прокрутки чата ---
        if (scrollContainerSelector) {
            cssStyles += `
/* ** Контейнер прокрутки чата (${scrollContainerSelector}) ** */
.${scrollContainerSelector} {
  contain: layout paint style;
  will-change: transform;
  scroll-behavior: ${CONFIG.enableSmoothScroll ? 'smooth' : 'auto'} !important;
  scrollbar-gutter: stable both-edges;
}\n\n`;
        } else { log.warn('Селектор контейнера прокрутки чата не определен.'); }

        // --- Элемент сообщения чата ---
        if (messageItemSelector) {
            cssStyles += `
/* ** Элемент сообщения чата (${messageItemSelector}) ** */
.${messageItemSelector} {
  contain: content;
  ${CONFIG.aggressivelyDisableAnimations ? `
  transition: none !important; animation: none !important;
  animation-duration: 0s !important; transition-duration: 0s !important;` : ''}
}\n\n`;
        } else { log.warn('Селектор элемента сообщения чата не определен.'); }

        if (CONFIG.optimizeCodeBlocks && codeContainerSelector && codeContentSelector) {
            log.info('Применение ИСПРАВЛЕННОГО CSS для блоков кода (прокрутка, кнопка, max-height)...');

            cssStyles += `
/* ** 1. Обертка блока кода (${codeContainerSelector}) ** */
/* Должна только позиционировать кнопку и быть контейнером. НЕ должна скрывать overflow! */
${codeContainerSelector} {
  display: block !important;
  position: relative !important; /* Для позиционирования кнопки */
  contain: layout style paint;
  box-sizing: border-box;
  /* !!! УБИРАЕМ overflow: hidden ОТСЮДА !!! */
  /* overflow: hidden !important; */
  /* !!! УБИРАЕМ max-height ОТСЮДА !!! */
  /* max-height: ... */
  ${CONFIG.aggressivelyDisableAnimations ? `
  transition: none !important; animation: none !important;
  animation-duration: 0s !important; transition-duration: 0s !important;` : ''}
  /* Добавим небольшой нижний отступ, чтобы футер не прилипал к следующему элементу */
  margin-bottom: 8px !important;
  /* Добавим верхний отступ, чтобы кнопка копирования не заезжала на текст выше */
  margin-top: 8px !important;
}\n\n`;


            cssStyles += `
/* ** 2. Внутренний элемент с кодом (${codeContentSelector}) - ОБЕСПЕЧИВАЕТ ПРОКРУТКУ ** */
/* Этот элемент должен ограничиваться по высоте и иметь прокрутку */
${codeContentSelector} {
  display: block !important;
  box-sizing: border-box;
  contain: content;
  will-change: scroll-position;

  /* !!! ДОБАВЛЯЕМ max-height СЮДА !!! */
  ${CONFIG.codeBlockMaxHeight && CONFIG.codeBlockMaxHeight !== 'none' ?
                `max-height: ${CONFIG.codeBlockMaxHeight} !important;`
              : '' }

  /* !!! ДОБАВЛЯЕМ overflow СЮДА !!! */
  overflow-y: auto !important;     /* Вертикальная прокрутка */
  overflow-x: auto !important;     /* Горизонтальная прокрутка */

  /* Убираем height: auto, оно не нужно при max-height и overflow: auto */
  /* height: auto; */

  /* Отступы ВНУТРИ области прокрутки */
  padding: 0.8em 1em !important;
  /* Отступ справа оставляем для кнопки */
  padding-right: 55px !important;
  /* Нижний отступ можно уменьшить или убрать, т.к. футер теперь СНАРУЖИ прокрутки */
  /* padding-bottom: 2.5em !important; */
   padding-bottom: 0.8em !important; /* Симметрично верхнему */


  /* Сброс некоторых свойств */
  margin: 0 !important;
  min-height: unset !important; /* Не ограничиваем минимальную высоту */

   ${CONFIG.aggressivelyDisableAnimations ? `
   transition: none !important; animation: none !important;
   animation-duration: 0s !important; transition-duration: 0s !important;` : ''}

   /* Стили для текста внутри (на всякий случай) */
   white-space: pre !important; /* Сохраняем пробелы и переносы */
   word-wrap: normal !important; /* Отключаем автоматический перенос слов */

}\n\n`;


            if (copyButtonSelector) {
                cssStyles += `
/* ** 3. Кнопка Копирования (${copyButtonSelector}) ** */
/* Селектор теперь указывает на кнопку ВНУТРИ футера, который является соседом codeContentSelector */
${codeContainerSelector} ${copyButtonSelector} {
  /* Позиционируем кнопку абсолютно относительно ${codeContainerSelector} */
  position: absolute !important;
  top: 5px !important;          /* Отступ сверху от края обертки - чуть меньше */
  right: 5px !important;         /* Отступ справа от края обертки - чуть меньше */
  z-index: 10 !important;       /* Поверх всего */
  opacity: 0.6 !important;
  transition: opacity 0.2s ease-in-out !important;
  cursor: pointer !important;
}

/* Показываем кнопку четче при наведении на ВСЮ ОБЕРТКУ блока кода */
${codeContainerSelector}:hover ${copyButtonSelector} {
  opacity: 1 !important;
}

/* Стили самой кнопки при наведении/фокусе */
${codeContainerSelector} ${copyButtonSelector}:hover,
${codeContainerSelector} ${copyButtonSelector}:focus {
  opacity: 1 !important;
}
\n`;
            } else {
                log.warn('Селектор кнопки копирования не определен. Стили для кнопки пропущены.');
            }


            // Стили для футера (который теперь просто под блоком прокрутки)
            cssStyles += `
/* ** 4. Футер блока кода (${codeFooterSelector}) ** */
/* Футер теперь находится ПОД прокручиваемой областью */
${codeFooterSelector} {
    /* Можно добавить небольшой верхний отступ, чтобы отделить от прокрутки */
    /* margin-top: 4px; */
    /* Можно добавить стили фона/границы, если нужно */
     /* background-color: #2f333c; */
     /* border-top: 1px solid #555; */
     /* padding: 4px 8px; */ /* Отступы внутри футера */
     /* Сбросим margin по умолчанию, если он есть */
     margin: 0 !important;
     /* Позиционирование по умолчанию (static), не sticky */
}
\n`;


            if (CONFIG.forceCodeBlockBasicStyle) {
                log.info('Применение принудительного базового стиля для блоков кода...');
                cssStyles += `
/* ** 5. Принудительный Базовый Стиль (Применяется к ${codeContentSelector}) ** */
${codeContentSelector} {
  background-color: ${CONFIG.forcedCodeBlockBackgroundColor} !important;
  /* Границу лучше оставить на этом элементе, т.к. он прокручивается */
   border: ${CONFIG.forcedCodeBlockBorder} !important;
  color: #abb2bf !important;
  /* Стили для <pre> и <code> внутри */
  & pre, & code, & span { /* Применяем и к span подсветки */
      font-family: 'Fira Code', Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace !important;
      font-size: 0.9em !important;
      line-height: 1.4 !important;
      color: inherit !important; /* Наследуем цвет от родителя */
      background: none !important; /* Убираем фон у pre/code/span */
      white-space: inherit !important; /* Наследуем white-space */
  }
}\n
/* Убираем бордер с обертки при базовом стиле, он теперь на codeContentSelector */
/* ${codeContainerSelector} { border: none !important; } */
`;
                if (copyButtonSelector) {
                    cssStyles += `
/* Стили кнопки для базовой темы */
${codeContainerSelector} ${copyButtonSelector} {
  background-color: #444 !important;
  color: #ccc !important;
  border: 1px solid #666 !important;
  border-radius: 4px !important; /* Скруглим углы */
  padding: 2px 6px !important; /* Немного уменьшим padding */
}
${codeContainerSelector} ${copyButtonSelector}:hover {
  background-color: #555 !important;
  color: #eee !important;
}
                 \n`;
                }
            }

            cssStyles += `
/* --- Конец стилей блоков кода --- */\n`;

        } else if (CONFIG.optimizeCodeBlocks) {
            const missing = [!codeContainerSelector && 'codeBlockContainer', !codeContentSelector && 'codeContentElement'].filter(Boolean);
            log.warn(`Оптимизация блоков кода включена, но селекторы не определены: ${missing.join(', ')}. CSS для блоков кода пропущен.`);
        }


        // --- Применение CSS ---
        if (typeof GM_addStyle === 'function') {
            try {
                GM_addStyle(cssStyles);
                log.success('CSS оптимизации успешно применены через GM_addStyle.');
            } catch (error) {
                log.error('GM_addStyle завершился с ошибкой. Попытка fallback-инъекции <style>.', error);
                injectStyleElement(cssStyles);
            }
        } else {
            log.warn('GM_addStyle недоступен. Используется fallback-инъекция <style>.');
            injectStyleElement(cssStyles);
        }
    }

    function observeAndRemoveCookieBanner() {
        if (!CONFIG.removeCookieBanner) return;
        const bannerSelector = SELECTORS.cookieBanner;
        if (!bannerSelector) {
            log.warn("Селектор баннера cookie (SELECTORS.cookieBanner) не определен. Удаление пропускается.");
            return;
        }

        log.info(`Наблюдение за DOM для удаления баннера cookie ('${bannerSelector}')...`);
        let bannerRemoved = false;
        let observer = null; // Держим ссылку на observer

        const processNode = (node) => {
            if (bannerRemoved || node.nodeType !== 1) return null;
            try {
                if (node.matches(bannerSelector)) return node;
                // Ищем только внутри добавленного узла
                if (typeof node.querySelector === 'function') return node.querySelector(bannerSelector);
            } catch (e) { log.warn(`Ошибка при проверке узла на соответствие селектору баннера '${bannerSelector}': ${e.message}`); }
            return null;
        };

        const hideBanner = (bannerElement) => {
            try {
                bannerElement.style.setProperty('display', 'none', 'important');
                log.success(`Баннер cookie ('${bannerSelector}') найден и скрыт.`);
                bannerRemoved = true;
                if (observer) { // Отключаем observer после успеха
                    observer.disconnect();
                    log.info("MutationObserver для баннера cookie отключен.");
                }
                return true;
            } catch (error) { log.error(`Ошибка при попытке скрыть баннер cookie ('${bannerSelector}').`, error); return false; }
        };

        const mutationCallback = (mutationsList, obs) => {
            if (bannerRemoved) { obs.disconnect(); return; }
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        const banner = processNode(node);
                        if (banner && hideBanner(banner)) return;
                        if (node.nodeType === 1 && node.matches && node.matches(bannerSelector) && hideBanner(node)) return;
                    }
                } else if (mutation.type === 'attributes') {
                    if (mutation.target.matches && mutation.target.matches(bannerSelector) && hideBanner(mutation.target)) return;
                }
            }
        };

        observer = new MutationObserver(mutationCallback);

        const startObserving = () => {
            const observeTarget = document.body || document.documentElement;
            if (observeTarget && !bannerRemoved) {
                try {
                    observer.observe(observeTarget, { childList: true, subtree: true, attributes: true });
                    log.info(`Начато наблюдение за DOM ('${observeTarget.tagName}') для баннера cookie ('${bannerSelector}').`);
                } catch (e) { log.error(`Не удалось начать наблюдение за DOM для баннера cookie: ${e.message}`, e); }
            } else if (!bannerRemoved) { log.warn("Не удалось найти target (body/documentElement) для наблюдения за баннером cookie."); }
        };

        const checkExistingBanner = () => {
            if (bannerRemoved) return;
            try {
                const existingBanner = document.querySelector(bannerSelector);
                if (existingBanner) {
                    log.info(`Найден существующий баннер cookie ('${bannerSelector}') при запуске.`);
                    hideBanner(existingBanner);
                } else {
                    log.info(`Существующий баннер cookie ('${bannerSelector}') не найден при запуске.`);
                }
            } catch (error) { log.error(`Ошибка при проверке существующего баннера cookie ('${bannerSelector}').`, error); }
        };

        setTimeout(() => {
            checkExistingBanner();
            if (!bannerRemoved) {
                startObserving();
            }
        }, 250);
    }


    function initialize() {
        log.info(`Запуск инициализации ${SCRIPT_NAME} v${SCRIPT_VERSION}...`);
        tryDisableGTM();
        applyCSSOptimizations(); // Применяем CSS с обновленными селекторами
        if (CONFIG.removeCookieBanner) {
            observeAndRemoveCookieBanner();
        }
        log.success(`${SCRIPT_NAME} базовые настройки применены. Селекторы обновлены.`);
        log.warn('Если блоки кода все еще отображаются некорректно, проверьте консоль на ошибки и актуальность ВСЕХ селекторов в скрипте.');
    }

    // --- Запуск Инициализации ---
    try {
        let initStartedFlag = `aiStudioPerfStyleFixInitialized_${SCRIPT_VERSION}`;
        if (window[initStartedFlag]) {
            log.warn('Попытка повторной инициализации прервана.');
            return;
        }
        window[initStartedFlag] = true;

        if (document.readyState === 'complete') {
            log.info('Документ уже полностью загружен. Запуск initialize() через setTimeout.');
            setTimeout(initialize, 100);
        } else {
            window.addEventListener('load', () => {
                log.info('Событие window.load сработало. Запуск initialize().');
                initialize();
            }, { once: true });
        }

    } catch (initError) {
        log.error('Критическая ошибка во время setup вызова initialize()!', initError);
        window[initStartedFlag] = false;
    }

})();