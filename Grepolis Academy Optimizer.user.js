// ==UserScript==
// @name         Grepolis Academy Optimizer
// @version      1.0
// @include      https://*.grepolis.com/game/*
// @author       Acilar
// @description  Set yes/no research targets for each city or town group
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'grepo_academy_targets_scoped_v1';
    const DRAFT_KEY = 'grepo_academy_draft_';
    const PANEL_ID = 'academy_optimizer_panel';
    const CONTROL_CLASS = 'ao-target';

    function getTownId() {
        return String(window.Game?.townId || window.ITown?.town_id || 'unknown');
    }

    function validGroupId(id) {
        return id !== undefined && id !== null && String(id) !== '' && String(id) !== '-1';
    }

    // Match the Senate Optimizer's group lookup so both tools use the same scope.
    function getGroupId() {
        const townId = getTownId();
        try {
            for (const group of Object.values(window.MM?.getModels?.() || {})) {
                for (const model of Object.values(group || {})) {
                    const a = model.attributes || {};
                    const modelTownId = a.town_id || a.townId || a.townid;
                    const id = a.town_group_id || a.group_id || a.groupId || a.townGroupId;
                    if (String(modelTownId) === townId && validGroupId(id)) return String(id);
                }
            }
        } catch {}
        try {
            for (const group of Object.values(window.MM?.getCollections?.() || {})) {
                for (const collection of Object.values(group || {})) {
                    for (const model of collection.models || []) {
                        const a = model.attributes || {};
                        const modelTownId = a.town_id || a.townId || a.townid;
                        const id = a.town_group_id || a.group_id || a.groupId || a.townGroupId;
                        if (String(modelTownId) === townId && validGroupId(id)) return String(id);
                    }
                }
            }
        } catch {}
        return 'default';
    }

    function readTargets() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            data.cities ||= {};
            data.groups ||= {};
            return data;
        } catch {
            return { cities: {}, groups: {} };
        }
    }

    function readDraft() {
        try { return JSON.parse(localStorage.getItem(DRAFT_KEY + getTownId()) || '{}'); }
        catch { return {}; }
    }

    function writeDraft(draft) {
        localStorage.setItem(DRAFT_KEY + getTownId(), JSON.stringify(draft));
    }

    function getSavedTarget(id) {
        const data = readTargets();
        const townId = getTownId();
        const groupId = getGroupId();
        if (data.cities[townId]?.[id] !== undefined) return data.cities[townId][id];
        if (data.groups[groupId]?.[id] !== undefined) return data.groups[groupId][id];
        return '';
    }

    function getTarget(id) {
        const draft = readDraft();
        return draft[id] !== undefined ? draft[id] : getSavedTarget(id);
    }

    function researchData() {
        return window.GameData?.researches || {};
    }

    function getAcademyWindow() {
        return [...document.querySelectorAll('.js-window-main-container.academy')]
            .find(root => root.querySelector('.window_content .academy_image') &&
                root.querySelector('.window_content .tech_tree_box.js-tech-tree')) || null;
    }

    function getResearchState() {
        try {
            const town = window.ITowns?.getTown?.(getTownId());
            const researches = town?.researches?.();
            return researches?.attributes || researches || {};
        } catch {
            return {};
        }
    }

    function isQueued(id, academyWindow) {
        return [...academyWindow.querySelectorAll('.js-queue-item.queued_building_order')]
            .some(item => item.classList.contains(id));
    }

    function isResearchComplete(id, icon, academyWindow) {
        // Grepolis can leave `inactive` on the tree icon while an order is
        // queued. The town model and queue are authoritative when available;
        // otherwise the icon class distinguishes researched from unresearched.
        if (getResearchState()[id] === true || isQueued(id, academyWindow)) return true;
        return Boolean(icon && !icon.classList.contains('inactive'));
    }

    function saveAll(scope, academyWindow) {
        if (!academyWindow?.isConnected) return;
        const data = readTargets();
        const key = scope === 'city' ? getTownId() : getGroupId();
        const collection = scope === 'city'
            ? (data.cities[key] ||= {})
            : (data.groups[key] ||= {});
        academyWindow.querySelectorAll(`.tech_tree_box .${CONTROL_CLASS}[data-research]`).forEach(control => {
            collection[control.dataset.research] = control.dataset.target || '';
            control.classList.remove('ao-dirty');
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function injectStyle() {
        if (document.getElementById(PANEL_ID + '_style')) return;
        const style = document.createElement('style');
        style.id = PANEL_ID + '_style';
        style.textContent = `
            #${PANEL_ID} { position:absolute; right:30px; bottom:20px; z-index:999999; display:flex; flex-direction:column; align-items:flex-end; gap:4px; margin:0; }
            #${PANEL_ID} button { min-width:78px; height:20px; padding:0 7px; border:1px solid #8a672c; border-radius:2px; background:#0F213A; color:wheat; font:bold 10px Arial,sans-serif; cursor:pointer; }
            #${PANEL_ID} button:hover { background:linear-gradient(#fff5d9,#e5cc91); color:#392810; }
            .${CONTROL_CLASS} { position:absolute !important; top:1px !important; right:1px !important; z-index:10000 !important; width:19px !important; height:19px !important; padding:0 !important; border:1px solid rgba(35,25,15,.75) !important; border-radius:3px !important; background:transparent !important; color:inherit !important; font:bold 12px/17px Arial,sans-serif !important; text-align:center !important; cursor:pointer !important; box-sizing:border-box !important; }
            .${CONTROL_CLASS}.ao-match { background:#bfe49a !important; color:#225d08 !important; }
            .${CONTROL_CLASS}.ao-mismatch { background:#efaaa0 !important; color:#8d1008 !important; }
            .${CONTROL_CLASS}.ao-unmarked-done { background:#f2c36f !important; color:#754400 !important; }
            .${CONTROL_CLASS}.ao-dirty { outline:2px solid #285d9b !important; }
        `;
        document.head.appendChild(style);
    }

    function createPanel(academyWindow) {
        if (!academyWindow?.isConnected) return;
        let panel = document.getElementById(PANEL_ID);
        if (!panel) {
            panel = document.createElement('div');
            panel.id = PANEL_ID;
            panel.innerHTML = '<button type="button" class="ao-save-city">Save City</button><button type="button" class="ao-save-group">Save Group</button>';
            panel.querySelector('.ao-save-city').addEventListener('click', () => saveAll('city', panel._academyWindow));
            panel.querySelector('.ao-save-group').addEventListener('click', () => saveAll('group', panel._academyWindow));
        }
        const host = academyWindow.querySelector('.window_content .tech_tree_box.js-tech-tree');
        if (!host) return;
        panel._academyWindow = academyWindow;
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        if (panel.parentElement !== host) host.prepend(panel);
    }

    function findResearchCards(academyWindow) {
        const data = researchData();
        const cards = new Map();
        // Only decorate the research tree. The same research icon is also
        // rendered in the queue, where it must not replace the tree card in
        // the ID map or receive a second target control.
        academyWindow.querySelectorAll('.tech_tree_box .research_box > .research_icon').forEach(icon => {
            const card = icon.closest('.research_box') || icon.parentElement;
            if (!card) return;

            // The Academy can render legacy/feature variants such as
            // `take_over_old` or `booty_bpv` that do not exactly match the
            // research key in GameData. Prefer the action's canonical ID,
            // then an exact GameData class, then the icon's research class.
            const actionId = card.querySelector('[data-research_id]')?.dataset.research_id;
            const classNames = [...icon.classList];
            const exactId = classNames.find(name => Object.prototype.hasOwnProperty.call(data, name));
            const researchIndex = classNames.indexOf('research');
            let iconId = researchIndex >= 0 ? classNames[researchIndex + 1] : null;
            if (iconId?.endsWith('_old') && Object.prototype.hasOwnProperty.call(data, iconId.slice(0, -4))) {
                iconId = iconId.slice(0, -4);
            }
            const id = actionId || exactId || iconId;
            if (!id || ['inactive', 'research'].includes(id)) return;
            const research = data[id] || data[actionId] || data[iconId] || null;
            cards.set(id, { card, icon, research });
        });
        return cards;
    }

    function updateControl(control) {
        const id = control.dataset.research;
        const target = control.dataset.target === 'yes';
        const academyWindow = control.closest('.js-window-main-container.academy');
        const researched = isResearchComplete(id, control._aoResearchIcon, academyWindow);
        control.classList.remove('ao-match', 'ao-mismatch', 'ao-unmarked-done');
        control.textContent = target ? '✓' : '□';
        if (target && researched) control.classList.add('ao-match');
        else if (target && !researched) control.classList.add('ao-mismatch');
        else if (!target && researched) control.classList.add('ao-unmarked-done');
        control.title = `${id}: target ${target ? 'researched' : 'not researched'}; currently ${researched ? 'researched' : 'not researched'}. Click to toggle target.`;
        control.setAttribute('aria-label', control.title);
    }

    function createControls(academyWindow) {
        for (const [id, info] of findResearchCards(academyWindow)) {
            let control = info.card.querySelector(`.${CONTROL_CLASS}[data-research="${CSS.escape(id)}"]`);
            if (!control) {
                control = document.createElement('button');
                control.type = 'button';
                control.className = CONTROL_CLASS;
                control.dataset.research = id;
                control.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const next = control.dataset.target === 'yes' ? '' : 'yes';
                    control.dataset.target = next;
                    const draft = readDraft();
                    draft[id] = next;
                    writeDraft(draft);
                    control.classList.add('ao-dirty');
                    updateControl(control);
                });
                ['mousedown', 'mouseup', 'keydown', 'keyup'].forEach(type => control.addEventListener(type, e => e.stopPropagation()));
            }
            const target = getTarget(id);
            if (!control.dataset.initialized) {
                control.dataset.target = target === 'yes' ? 'yes' : '';
                control.dataset.initialized = '1';
            }
            control._aoResearchIcon = info.icon;
            if (control.parentElement !== info.card) {
                if (getComputedStyle(info.card).position === 'static') info.card.style.position = 'relative';
                info.card.appendChild(control);
            }
            updateControl(control);
        }
    }

    let lastTownId = null;
    let lastGroupId = null;
    function watcher() {
        const data = researchData();
        if (!Object.keys(data).length) return;
        const academyWindow = getAcademyWindow();
        if (!academyWindow) return;
        // Clear controls left outside the Academy by an earlier global version.
        document.querySelectorAll(`.${CONTROL_CLASS}`).forEach(control => {
            if (!academyWindow.contains(control)) control.remove();
        });
        injectStyle();
        createPanel(academyWindow);
        const townId = getTownId();
        const groupId = getGroupId();
        if (townId !== lastTownId || groupId !== lastGroupId) {
            academyWindow.querySelectorAll(`.tech_tree_box .${CONTROL_CLASS}`).forEach(control => {
                const saved = getTarget(control.dataset.research);
                control.dataset.target = saved === 'yes' || saved === 'no' ? saved : '';
                control.classList.remove('ao-dirty');
            });
            lastTownId = townId;
            lastGroupId = groupId;
        }
        createControls(academyWindow);
    }

    setInterval(watcher, 500);
})();
