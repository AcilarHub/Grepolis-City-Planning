// ==UserScript==
// @name         Grepolis Senate Optimizer
// @version      1.0
// @include      https://*.grepolis.com/game/*
// @author       Acilar
// @description  Provides a building target interface
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'grepo_senate_targets_scoped_v1';
    const DRAFT_KEY = 'grepo_senate_draft_';
    const PANEL_ID = 'senate_optimizer_panel';

    // Standard buildings only.
    const BUILDINGS = [
        { id: 'main', name: 'Senate', max: 25 },
        { id: 'hide', name: 'Cave', max: 10 },
        { id: 'lumber', name: 'Timber Camp', max: 40 },
        { id: 'stoner', name: 'Quarry', max: 40 },
        { id: 'ironer', name: 'Silver Mine', max: 40 },
        { id: 'market', name: 'Marketplace', max: 30 },
        { id: 'docks', name: 'Harbor', max: 30 },
        { id: 'barracks', name: 'Barracks', max: 30 },
        { id: 'wall', name: 'City Wall', max: 25 },
        { id: 'storage', name: 'Warehouse', max: 35 },
        { id: 'farm', name: 'Farm', max: 45 },
        { id: 'academy', name: 'Academy', max: 36 },
        { id: 'temple', name: 'Temple', max: 30 }
    ];

    // Special buildings: one target per group.
    const SPECIAL_GROUPS = [
        {
            id: 'special_group_1',
            domId: 'special_group_1',
            side: 'left',
            name: 'Special group 1',
            buildings: [
                { id: 'theater', name: 'Theater' },
                { id: 'thermal', name: 'Thermal Baths' },
                { id: 'library', name: 'Library' },
                { id: 'lighthouse', name: 'Lighthouse' }
            ]
        },
        {
            id: 'special_group_2',
            domId: 'special_group_2',
            side: 'right',
            name: 'Special group 2',
            buildings: [
                { id: 'tower', name: 'Tower' },
                { id: 'statue', name: 'Statue' },
                { id: 'oracle', name: 'Oracle' },
                { id: 'trade_office', name: 'Trade Office' }
            ]
        }
    ];

    // --------------------------------------------------
    // TOWN AND GROUP
    // --------------------------------------------------

    function getTownId() {
        return String(Game?.townId || ITown?.town_id || 'unknown');
    }

    function isValidGroupId(id) {
        return id !== undefined &&
            id !== null &&
            String(id) !== '' &&
            String(id) !== '-1';
    }

    function getGroupId() {
        const townId = getTownId();

        try {
            const models = MM.getModels?.() || {};

            for (const modelGroup of Object.values(models)) {
                for (const model of Object.values(modelGroup || {})) {
                    const a = model.attributes || {};

                    const modelTownId =
                        a.town_id || a.townId || a.townid;

                    const groupId =
                        a.town_group_id ||
                        a.group_id ||
                        a.groupId ||
                        a.townGroupId;

                    if (
                        String(modelTownId) === townId &&
                        isValidGroupId(groupId)
                    ) {
                        return String(groupId);
                    }
                }
            }
        } catch {}

        try {
            const collections = MM.getCollections?.() || {};

            for (const collectionGroup of Object.values(collections)) {
                for (const collection of Object.values(collectionGroup || {})) {
                    for (const model of collection.models || []) {
                        const a = model.attributes || {};

                        const modelTownId =
                            a.town_id || a.townId || a.townid;

                        const groupId =
                            a.town_group_id ||
                            a.group_id ||
                            a.groupId ||
                            a.townGroupId;

                        if (
                            String(modelTownId) === townId &&
                            isValidGroupId(groupId)
                        ) {
                            return String(groupId);
                        }
                    }
                }
            }
        } catch {}

        return 'default';
    }

    // --------------------------------------------------
    // STORAGE
    // --------------------------------------------------

    function getTargets() {
        try {
            const data = JSON.parse(
                localStorage.getItem(STORAGE_KEY) || '{}'
            );

            data.cities ||= {};
            data.groups ||= {};

            return data;
        } catch {
            return { cities: {}, groups: {} };
        }
    }

    function saveTargets(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function getDraft() {
        try {
            return JSON.parse(
                localStorage.getItem(DRAFT_KEY + getTownId()) || '{}'
            );
        } catch {
            return {};
        }
    }

    function saveDraft(draft) {
        localStorage.setItem(
            DRAFT_KEY + getTownId(),
            JSON.stringify(draft)
        );
    }

    function getTarget(id) {
        const data = getTargets();

        const townId = getTownId();
        const groupId = getGroupId();

        if (data.cities[townId]?.[id] !== undefined) {
            return data.cities[townId][id];
        }

        if (data.groups[groupId]?.[id] !== undefined) {
            return data.groups[groupId][id];
        }

        return '';
    }

    function getTargetValue(id) {
        const draft = getDraft();

        if (draft[id] !== undefined) {
            return draft[id];
        }

        return getTarget(id);
    }

    function setDraft(id, value) {
        const draft = getDraft();
        draft[id] = value;
        saveDraft(draft);
    }

    // --------------------------------------------------
    // SAVE TARGETS
    // --------------------------------------------------

    function saveAllTargets(scope) {
        const data = getTargets();

        const townId = getTownId();
        const groupId = getGroupId();

        const targetContainer = scope === 'city'
            ? (data.cities[townId] ||= {})
            : (data.groups[groupId] ||= {});

        BUILDINGS.forEach(building => {
            const input = document.querySelector(
                `.so-target[data-building="${building.id}"]`
            );

            if (!input) return;

            targetContainer[building.id] = input.value === ''
                ? ''
                : Math.max(0, Number(input.value) || 0);

            input.classList.remove('dirty');
        });

        SPECIAL_GROUPS.forEach(group => {
            const selector = getSpecialSelector(group.id);

            if (!selector) return;

            targetContainer[group.id] = selector.value;
            selector.classList.remove('dirty');
        });

        saveTargets(data);
    }

    // --------------------------------------------------
    // BUILDING LEVELS
    // --------------------------------------------------

    function getBuildingData() {
        try {
            return window.BuildingMain?.buildings || {};
        } catch {
            return {};
        }
    }

    function getCurrentLevel(id) {
        const entry = getBuildingData()[id];

        if (entry) {
            const candidates = [
                entry.current_level,
                entry.level,
                entry.building?.level,
                entry.attributes?.level
            ];

            for (const value of candidates) {
                if (value !== undefined && value !== null) {
                    const number = Number(value);

                    if (Number.isFinite(number)) {
                        return number;
                    }
                }
            }
        }

        const element = document.querySelector(
            '#building_main_' + id + ' .level'
        );

        if (element) {
            return Number(element.textContent.trim()) || 0;
        }

        return 0;
    }

    // --------------------------------------------------
    // BUILDING QUEUE
    // --------------------------------------------------

    function getQueueItems() {
        return [
            ...document.querySelectorAll(
                '#building_tasks_main .js-queue-item.queued_building_order'
            )
        ];
    }

    function getQueue() {
        return getQueueItems()
            .map(item => {
                const classes = [...item.classList];

                const building = BUILDINGS.find(b =>
                    classes.includes(b.id)
                );

                if (!building) return null;

                const levelText =
                    item.querySelector('.building_level')?.textContent || '';

                const match = levelText.match(/\d+/);

                if (!match) return null;

                return {
                    id: building.id,
                    level: Number(match[0]),
                    demolition: item.classList.contains('tearing_down'),
                    index: Number(item.dataset.order_index || 0)
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.index - b.index);
    }

    function getProjectedLevel(id) {
        let projected = getCurrentLevel(id);

        getQueue()
            .filter(order => order.id === id)
            .forEach(order => {
                projected = order.level;
            });

        return projected;
    }

    // --------------------------------------------------
    // SPECIAL BUILDING QUEUE AND STATE
    // --------------------------------------------------

    function getSpecialQueue(group) {
        return getQueueItems()
            .map(item => {
                const classes = [...item.classList];

                const building = group.buildings.find(b =>
                    classes.includes(b.id)
                );

                if (!building) return null;

                return {
                    id: building.id,
                    demolition: item.classList.contains('tearing_down'),
                    index: Number(item.dataset.order_index || 0)
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.index - b.index);
    }

    function getSpecialBuildingState(group) {
        const queue = getSpecialQueue(group);

        if (queue.length) {
            const latest = queue[queue.length - 1];

            return {
                id: latest.id,
                status: 'queued'
            };
        }

        for (const building of group.buildings) {
            const normalCard = document.getElementById(
                'building_main_' + building.id
            );

            if (normalCard) {
                return {
                    id: building.id,
                    status: 'built'
                };
            }

            const teardown = [
                ...document.querySelectorAll('.special_tear_down')
            ].find(element => {
                const onclick = element.getAttribute('onclick') || '';

                return onclick.includes(
                    `tearDown('${building.id}')`
                ) || onclick.includes(
                    `tearDown("${building.id}")`
                );
            });

            if (teardown) {
                return {
                    id: building.id,
                    status: 'built'
                };
            }
        }

        return {
            id: null,
            status: 'none'
        };
    }

    // --------------------------------------------------
    // STYLING
    // --------------------------------------------------

    function injectStyle() {
        if (document.getElementById(PANEL_ID + '_style')) return;

        const style = document.createElement('style');
        style.id = PANEL_ID + '_style';

        style.textContent = `
            #${PANEL_ID} {
                position: absolute;
                top: 15px;
                right: 60px;
                z-index: 999999;
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 3px;
                padding: 0;
                margin: 0;
                background: transparent;
                border: none;
                border-radius: 0;
                font-family: Arial, sans-serif;
                white-space: nowrap;
            }

            #${PANEL_ID} button {
                height: 20px;
                min-width: 78px;
                padding: 0 8px;
                border: 1px solid #8a672c;
                border-radius: 2px;
                background: #0F213A;
                color: wheat;
                font-size: 10px;
                font-weight: bold;
                cursor: pointer;
                box-sizing: border-box;
                text-align: center;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
            }

            #${PANEL_ID} button:hover {
                background: linear-gradient(#fff5d9, #e5cc91);
                color: #392810;
            }

            /* Standard building target inputs. */
            .so-target {
                position: absolute !important;
                top: 2px !important;
                right: 2px !important;
                z-index: 1000 !important;
                width: 25px !important;
                height: 17px !important;
                min-width: 25px !important;
                margin: 0 !important;
                padding: 0 1px !important;
                border: 1px solid rgba(60, 45, 25, 0.55) !important;
                border-radius: 3px !important;
                font-family: Arial, sans-serif !important;
                font-size: 10px !important;
                line-height: 15px !important;
                font-weight: bold !important;
                text-align: center !important;
                box-sizing: border-box !important;
                outline: none !important;
                cursor: text !important;
            }

            .so-target.so-need,
            .so-special-target.so-need {
                background: #f2b59d !important;
                color: #990000 !important;
            }

            .so-target.so-done,
            .so-special-target.so-done {
                background: #c7eca0 !important;
                color: #2b7807 !important;
            }

            .so-target.so-extra,
            .so-special-target.so-extra {
                background: #f7c97b !important;
                color: #8a4b00 !important;
            }

            .so-target.so-empty {
                background: rgba(255,255,255,0.85) !important;
                color: #555 !important;
            }

            .so-target.dirty,
            .so-special-target.dirty {
                border: 1px solid #285d9b !important;
                box-shadow: 0 0 2px #285d9b !important;
            }

            .so-target::-webkit-inner-spin-button,
            .so-target::-webkit-outer-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }

            .so-target {
                -moz-appearance: textfield;
            }

            /* Special building target selectors. */
            .so-special-target {
                position: absolute !important;
                top: 2px !important;
                z-index: 9999 !important;
                display: block !important;
                width: 110px !important;
                min-width: 110px !important;
                height: 19px !important;
                margin: 0 !important;
                padding: 0 2px !important;
                border: 1px solid rgba(60, 45, 25, 0.55) !important;
                border-radius: 3px !important;
                background: rgba(255,255,255,0.9) !important;
                color: #333 !important;
                font-family: Arial, sans-serif !important;
                font-size: 10px !important;
                line-height: 17px !important;
                font-weight: bold !important;
                box-sizing: border-box !important;
                outline: none !important;
                cursor: pointer !important;
            }

            .so-special-target[data-side="left"] {
                left: -113px !important;
                right: auto !important;
            }

            .so-special-target[data-side="right"] {
                right: -113px !important;
                left: auto !important;
            }
        `;

        document.head.appendChild(style);
    }

    // --------------------------------------------------
    // TOOLBAR
    // --------------------------------------------------

    function createPanel() {
        const buildings = document.querySelector('#buildings');
        const techtree = document.querySelector('#techtree');

        if (!buildings || !techtree) return null;

        injectStyle();

        let panel = document.getElementById(PANEL_ID);

        if (!panel) {
            panel = document.createElement('div');
            panel.id = PANEL_ID;

            panel.innerHTML = `
                <button class="so-save-city">Save City</button>
                <button class="so-save-group">Save Group</button>
            `;

            panel.querySelector('.so-save-city').addEventListener(
                'click',
                () => saveAllTargets('city')
            );

            panel.querySelector('.so-save-group').addEventListener(
                'click',
                () => saveAllTargets('group')
            );
        }

        if (panel.parentElement !== techtree) {
            techtree.insertBefore(panel, buildings);
        }

        return panel;
    }

    // --------------------------------------------------
    // STANDARD TARGET INPUTS
    // --------------------------------------------------

    function getInput(id) {
        return document.querySelector(
            `.so-target[data-building="${id}"]`
        );
    }

    function createIndicator(building) {
        const card = document.getElementById(
            'building_main_' + building.id
        );

        if (!card) return;

        let input = card.querySelector('.so-target');

        if (input) return;

        input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = String(building.max);
        input.step = '1';
        input.className = 'so-target';
        input.dataset.building = building.id;
        input.title = building.name + ' target level';
        input.value = getTargetValue(building.id);

        input.addEventListener('input', () => {
            input.classList.add('dirty');
            setDraft(building.id, input.value);
            updateIndicators();
        });

        input.addEventListener('change', () => {
            if (input.value === '') {
                setDraft(building.id, '');
                updateIndicators();
                return;
            }

            const value = Math.max(
                0,
                Math.min(
                    building.max,
                    Number(input.value) || 0
                )
            );

            input.value = String(value);
            setDraft(building.id, input.value);
            updateIndicators();
        });

        [
            'click',
            'mousedown',
            'mouseup',
            'keydown',
            'keyup',
            'keypress',
            'wheel'
        ].forEach(event => {
            input.addEventListener(event, e => e.stopPropagation());
        });

        card.appendChild(input);
    }

    function createIndicators() {
        BUILDINGS.forEach(createIndicator);
    }

    // --------------------------------------------------
    // SPECIAL TARGET SELECTORS
    // --------------------------------------------------

    function getSpecialSelector(groupId) {
        return document.querySelector(
            `.so-special-target[data-special-group="${groupId}"]`
        );
    }

    function createSpecialSelector(group) {
        const buildings = document.querySelector('#buildings');

        if (!buildings) return;

        let anchor = document.getElementById(group.domId);

        if (!anchor) {
            for (const building of group.buildings) {
                anchor = document.getElementById(
                    'building_main_' + building.id
                );

                if (anchor) break;
            }
        }

        if (!anchor) {
            anchor = buildings;
        }

        let selector = getSpecialSelector(group.id);

        if (!selector) {
            selector = document.createElement('select');
            selector.className = 'so-special-target';
            selector.dataset.specialGroup = group.id;
            selector.dataset.side = group.side;
            selector.title = group.name + ' target';

            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = 'No target';
            selector.appendChild(emptyOption);

            group.buildings.forEach(building => {
                const option = document.createElement('option');
                option.value = building.id;
                option.textContent = building.name;
                selector.appendChild(option);
            });

            selector.addEventListener('change', () => {
                setDraft(group.id, selector.value);
                selector.classList.add('dirty');
                updateSpecialIndicators();
            });

            [
                'click',
                'mousedown',
                'mouseup',
                'keydown',
                'keyup',
                'keypress'
            ].forEach(event => {
                selector.addEventListener(event, e => e.stopPropagation());
            });
        }

        selector.dataset.side = group.side;

        if (selector.parentElement !== anchor) {
            anchor.appendChild(selector);
        }

        if (getComputedStyle(anchor).position === 'static') {
            anchor.style.position = 'relative';
        }

        selector.style.setProperty('position', 'absolute', 'important');
        selector.style.setProperty('top', '2px', 'important');

        if (group.side === 'left') {
            selector.style.setProperty('left', '-113px', 'important');
            selector.style.setProperty('right', 'auto', 'important');
        } else {
            selector.style.setProperty('right', '-113px', 'important');
            selector.style.setProperty('left', 'auto', 'important');
        }

        const currentValue = getTargetValue(group.id);

        if (selector.value !== currentValue) {
            selector.value = currentValue || '';
        }
    }

    function createSpecialSelectors() {
        SPECIAL_GROUPS.forEach(createSpecialSelector);
    }

    // --------------------------------------------------
    // UPDATE STANDARD INDICATORS
    // --------------------------------------------------

    function updateIndicators() {
        BUILDINGS.forEach(building => {
            const input = getInput(building.id);

            if (!input) return;

            const isEmpty = input.value === '';
            const target = Number(input.value);
            const projected = getProjectedLevel(building.id);

            input.classList.remove(
                'so-need',
                'so-done',
                'so-extra',
                'so-empty'
            );

            if (isEmpty) {
                input.classList.add('so-empty');
                return;
            }

            if (projected < target) {
                input.classList.add('so-need');
            } else if (projected > target) {
                input.classList.add('so-extra');
            } else {
                input.classList.add('so-done');
            }
        });

        updateSpecialIndicators();
    }

    // --------------------------------------------------
    // UPDATE SPECIAL BUILDING INDICATORS
    // --------------------------------------------------

    function updateSpecialIndicators() {
        SPECIAL_GROUPS.forEach(group => {
            const selector = getSpecialSelector(group.id);

            if (!selector) return;

            selector.classList.remove(
                'so-need',
                'so-done',
                'so-extra'
            );

            const targetId = selector.value;

            if (!targetId) return;

            const state = getSpecialBuildingState(group);

            if (state.id === targetId) {
                // Correct building built or queued.
                selector.classList.add('so-done');
            } else if (state.id && state.id !== targetId) {
                // A different building built or queued.
                selector.classList.add('so-extra');
            } else {
                // Selected building not yet built or queued.
                selector.classList.add('so-need');
            }
        });
    }

    // --------------------------------------------------
    // MAIN WATCHER
    // --------------------------------------------------

    let lastTownId = null;
    let lastGroupId = null;

    function watcher() {
        const buildings = document.querySelector('#buildings');

        if (!buildings) return;

        const townId = getTownId();
        const groupId = getGroupId();

        const townChanged = townId !== lastTownId;
        const groupChanged = groupId !== lastGroupId;

        createPanel();

        if (townChanged || groupChanged) {
            document.querySelectorAll(
                '.so-target[data-building]'
            ).forEach(input => {
                input.remove();
            });

            createIndicators();

            lastTownId = townId;
            lastGroupId = groupId;
        } else {
            createIndicators();
        }

        createSpecialSelectors();

        updateIndicators();
    }

    setInterval(watcher, 500);

})();
