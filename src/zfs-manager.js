(function() {
    "use strict";

    const cockpit = window.cockpit;

    // Utility functions
    const Utils = {
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        formatBytes(bytes, decimals = 2) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
        },

        parseBytes(sizeStr) {
            const units = { 'K': 1024, 'M': 1024**2, 'G': 1024**3, 'T': 1024**4, 'P': 1024**5 };
            const match = sizeStr.match(/^([\d.]+)([KMGPT])?/i);
            if (!match) return 0;
            const value = parseFloat(match[1]);
            const unit = match[2]?.toUpperCase();
            return unit ? value * (units[unit] || 1) : value;
        },

        generateId(name) {
            return name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        },

        showNotification(status, title, description, timeout = 5000) {
            const alertContainer = document.getElementById('alerts-notifications') || document.body;
            const alertId = 'alert-' + Date.now();
            const statusClass = status === 'success' ? 'pf-m-success' : 
                              status === 'warning' ? 'pf-m-warning' : 
                              status === 'danger' ? 'pf-m-danger' : 'pf-m-info';

            const alert = document.createElement('div');
            alert.id = alertId;
            alert.className = `pf-v6-c-alert ${statusClass}`;
            alert.innerHTML = `
                <h4 class="pf-v6-c-alert__title">${this.escapeHtml(title)}</h4>
                ${description ? `<div class="pf-v6-c-alert__description"><p>${this.escapeHtml(description)}</p></div>` : ''}
                <div class="pf-v6-c-alert__action">
                    <button class="pf-v6-c-button pf-m-plain" type="button" aria-label="Close">
                        <svg class="pf-v6-svg" viewBox="0 0 352 512" fill="currentColor" aria-hidden="true" role="img" width="1em" height="1em">
                            <path d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"></path>
                        </svg>
                    </button>
                </div>
            `;

            alertContainer.appendChild(alert);

            alert.querySelector('.pf-v6-c-button').addEventListener('click', () => {
                alert.remove();
            });

            if (timeout > 0) {
                setTimeout(() => alert.remove(), timeout);
            }
        }
    };

    // Modal component
    class Modal {
        constructor(title, content, options = {}) {
            this.title = title;
            this.content = content;
            this.options = { size: 'lg', ...options };
            this.modal = null;
            this.backdrop = null;
            this.resolve = null;
            this.reject = null;
        }

        show() {
            return new Promise((resolve, reject) => {
                this.resolve = resolve;
                this.reject = reject;

                this.backdrop = document.createElement('div');
                this.backdrop.className = 'pf-v6-c-backdrop';
                this.backdrop.style.display = 'block';

                this.modal = document.createElement('div');
                this.modal.className = 'pf-v6-c-modal-box';
                this.modal.setAttribute('role', 'dialog');
                this.modal.innerHTML = `
                    <div class="pf-v6-c-modal-box__header">
                        <h1 class="pf-v6-c-modal-box__title">${Utils.escapeHtml(this.title)}</h1>
                        <button class="pf-v6-c-button pf-m-plain" type="button" aria-label="Close dialog">
                            <svg class="pf-v6-svg" viewBox="0 0 352 512" fill="currentColor" aria-hidden="true" role="img" width="1em" height="1em">
                                <path d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="pf-v6-c-modal-box__body">
                        ${this.content}
                    </div>
                    ${this.options.footer !== false ? `
                    <div class="pf-v6-c-modal-box__footer">
                        ${this.options.footer || `
                            <button class="pf-v6-c-button pf-m-primary" type="button">${this.options.confirmText || 'OK'}</button>
                            <button class="pf-v6-c-button pf-v6-m-link" type="button">Cancel</button>
                        `}
                    </div>
                    ` : ''}
                `;

                document.body.appendChild(this.backdrop);
                document.body.appendChild(this.modal);

                const closeBtn = this.modal.querySelector('.pf-v6-c-button[aria-label="Close dialog"]');
                const cancelBtn = this.modal.querySelector('.pf-v6-c-button.pf-v6-m-link');
                const confirmBtn = this.modal.querySelector('.pf-v6-c-button.pf-m-primary');

                const close = () => {
                    this.modal.remove();
                    this.backdrop.remove();
                    if (this.reject) this.reject(new Error('Modal cancelled'));
                };

                closeBtn.addEventListener('click', close);
                if (cancelBtn) cancelBtn.addEventListener('click', close);
                if (confirmBtn) {
                    confirmBtn.addEventListener('click', () => {
                        const result = this.options.onConfirm ? this.options.onConfirm() : true;
                        if (result !== false) {
                            this.modal.remove();
                            this.backdrop.remove();
                            if (this.resolve) this.resolve(result);
                        }
                    });
                }

                this.backdrop.addEventListener('click', (e) => {
                    if (e.target === this.backdrop) close();
                });
            });
        }

        close() {
            if (this.modal) {
                this.modal.remove();
                this.backdrop.remove();
            }
        }
    }

    // ZFS Manager main class
    class ZFSManager {
        constructor() {
            this.container = document.getElementById('app');
            this.pools = [];
            this.selectedPool = null;
            this.init();
        }

        init() {
            this.checkRequirements();
            this.setupEventListeners();
            this.loadPools();
        }

        async checkRequirements() {
            // Check if ZFS is available
            const proc = cockpit.spawn(['which', 'zpool']);
            proc.fail(() => {
                document.getElementById('alerts-requirements').classList.remove('hidden');
                document.getElementById('alerts-requirements').innerHTML = `
                    <div class="pf-v6-c-alert pf-m-danger">
                        <h4 class="pf-v6-c-alert__title">ZFS not found</h4>
                        <div class="pf-v6-c-alert__description">
                            <p>ZFS tools are not installed. Please install zfsutils-linux (Debian/Ubuntu) or zfs (Fedora/RHEL).</p>
                        </div>
                    </div>
                `;
            });
            proc.done(() => {
                // Container is always visible, no need to remove hidden class
            });
        }

        setupEventListeners() {
            document.getElementById('btn-storagepools-refresh')?.addEventListener('click', () => this.loadPools());
            document.getElementById('btn-storagepools-create')?.addEventListener('click', () => this.showCreatePoolModal());
            document.getElementById('btn-storagepools-import')?.addEventListener('click', () => this.showImportPoolModal());
            document.getElementById('btn-filesystems-unlock')?.addEventListener('click', () => this.showUnlockFileSystemsModal());
            document.getElementById('btn-configure')?.addEventListener('click', () => this.showConfigureModal());
            document.getElementById('btn-about')?.addEventListener('click', () => this.showAboutModal());

            // Dropdown menu toggle
            const dropdownToggles = document.querySelectorAll('.pf-v6-c-menu-toggle__button');
            dropdownToggles.forEach(toggle => {
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const menuContainer = toggle.closest('.menu-dropdown-wrapper');
                    const menu = menuContainer?.querySelector('.pf-v6-c-menu');
                    if (menu) {
                        const isHidden = menu.hidden;
                        // Close all menus first
                        document.querySelectorAll('.pf-v6-c-menu').forEach(m => m.hidden = true);
                        document.querySelectorAll('.pf-v6-c-menu-toggle__button').forEach(t => t.setAttribute('aria-expanded', 'false'));
                        // Toggle this menu
                        if (isHidden) {
                            menu.hidden = false;
                            toggle.setAttribute('aria-expanded', 'true');
                        }
                    }
                });
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.menu-dropdown-wrapper')) {
                    document.querySelectorAll('.pf-v6-c-menu').forEach(menu => {
                        menu.hidden = true;
                    });
                    document.querySelectorAll('.pf-v6-c-menu-toggle__button').forEach(toggle => {
                        toggle.setAttribute('aria-expanded', 'false');
                    });
                }
            });
        }

        async loadPools() {
            try {
                this.showLoading();

                const proc = cockpit.spawn(['zpool', 'list', '-H', '-o', 
                    'name,size,allocated,free,fragmentation,health,readonly'], { err: 'message' });
                let output = '';

                proc.stream((data) => {
                    output += data;
                });

                proc.done((exitCode, data) => {
                    if (exitCode === 0) {
                        this.pools = this.parsePoolList(output);
                        this.renderPools();
                    } else {
                        const errorMsg = data || `Exit code: ${exitCode}`;
                        Utils.showNotification('danger', 'Error', `Failed to list ZFS pools: ${errorMsg}`);
                    }
                });

                proc.fail((error) => {
                    Utils.showNotification('danger', 'Error', 'Failed to list ZFS pools: ' + error);
                });
            } catch (error) {
                Utils.showNotification('danger', 'Error', error.message);
            }
        }

        parsePoolList(data) {
            const lines = data.split('\n').filter(line => line.trim());
            return lines.map(line => {
                const parts = line.split('\t');
                const size = Utils.parseBytes(parts[1]);
                const allocated = Utils.parseBytes(parts[2]);
                const free = Utils.parseBytes(parts[3]);
                const usage = size > 0 ? ((allocated / size) * 100).toFixed(1) : 0;

                return {
                    name: parts[0],
                    size: parts[1],
                    allocated: parts[2],
                    free: parts[3],
                    fragmentation: parts[4] || '0%',
                    health: parts[5],
                    readonly: parts[6] === 'on',
                    usage: usage,
                    id: Utils.generateId(parts[0])
                };
            });
        }

        renderPools() {
            const table = document.getElementById('table-storagepools');
            if (!table) return;

            const tbody = table.querySelector('tbody') || document.createElement('tbody');
            tbody.innerHTML = '';

            if (this.pools.length === 0) {
                tbody.innerHTML = `
                    <tr class="pf-v6-c-table__tr">
                        <td colspan="11" class="pf-v6-c-table__td pf-v6-m-center">
                            <div class="pf-v6-c-empty-state">
                                <div class="pf-v6-c-empty-state__content">
                                    <h2 class="pf-v6-c-empty-state__title">No storage pools found</h2>
                                    <p class="pf-v6-c-empty-state__body">Create a new storage pool to get started.</p>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
                table.appendChild(tbody);
                return;
            }

            this.pools.forEach(pool => {
                const row = this.createPoolRow(pool);
                tbody.appendChild(row);
            });

            table.appendChild(tbody);
            document.getElementById('spinner-storagepools').style.display = 'none';
        }

        createPoolRow(pool) {
            const row = document.createElement('tr');
            row.className = 'pf-v6-c-table__tr listing-ct-item';
            row.setAttribute('data-pool-name', pool.name);
            row.setAttribute('data-pool-id', pool.id);

            const healthClass = pool.health === 'ONLINE' ? 'pf-m-success' : 
                              pool.health === 'DEGRADED' ? 'pf-m-warning' : 'pf-m-danger';

            const poolId = Utils.generateId(pool.name);
            row.innerHTML = `
                <td tabindex="-1" class="pf-v6-c-table__td pf-v6-c-table__toggle">
                    <button aria-labelledby="${poolId}-name expand-toggle-${poolId}" id="expand-toggle-${poolId}" aria-expanded="false" aria-label="Details" class="pf-v6-c-button pf-m-plain" type="button">
                        <span class="pf-v6-c-button__icon">
                            <div class="pf-v6-c-table__toggle-icon">
                                <svg class="pf-v6-svg toggle-icon" viewBox="0 0 320 512" fill="currentColor" aria-hidden="true" role="img" width="1em" height="1em">
                                    <path d="M143 352.3L7 216.3c-9.4-9.4-9.4-24.6 0-33.9l22.6-22.6c9.4-9.4 24.6-9.4 33.9 0l96.4 96.4 96.4-96.4c9.4-9.4 24.6-9.4 33.9 0l22.6 22.6c9.4 9.4 9.4 24.6 0 33.9l-136 136c-9.2 9.4-24.4 9.4-33.8 0z"></path>
                                </svg>
                            </div>
                        </span>
                    </button>
                </td>
                <th tabindex="-1" data-label="Name" scope="row" class="pf-v6-c-table__th">
                    <span id="${poolId}-name">${Utils.escapeHtml(pool.name)}</span>
                </th>
                <td tabindex="-1" data-label="Health" class="pf-v6-c-table__td">
                    <span class="pf-v6-c-label ${healthClass}">
                        ${Utils.escapeHtml(pool.health)}
                    </span>
                </td>
                <td tabindex="-1" data-label="Size" class="pf-v6-c-table__td">${Utils.escapeHtml(pool.size)}</td>
                <td tabindex="-1" data-label="Allocated" class="pf-v6-c-table__td">${Utils.escapeHtml(pool.allocated)}</td>
                <td tabindex="-1" data-label="Free" class="pf-v6-c-table__td">${Utils.escapeHtml(pool.free)}</td>
                <td tabindex="-1" data-label="Fragmentation" class="pf-v6-c-table__td">${Utils.escapeHtml(pool.fragmentation)}</td>
                <td tabindex="-1" data-label="Usage" class="pf-v6-c-table__td">
                    <div class="pf-v6-c-progress">
                        <div class="pf-v6-c-progress__bar" role="progressbar" 
                             aria-valuenow="${pool.usage}" 
                             aria-valuemin="0" 
                             aria-valuemax="100">
                            <div style="width: ${pool.usage}%"></div>
                        </div>
                        <span class="pf-v6-c-progress__measure">${pool.usage}%</span>
                    </div>
                </td>
                <td tabindex="-1" data-label="" class="pf-v6-c-table__td">
                    <div class="btn-group">
                        <div class="menu-dropdown-wrapper">
                            <div class="pf-v6-c-menu-toggle pf-m-plain">
                                <button class="pf-v6-c-menu-toggle__button" type="button" aria-expanded="false" id="${poolId}-action-kebab">
                                    <span class="pf-v6-c-menu-toggle__text">
                                        <svg class="pf-v6-svg" viewBox="0 0 192 512" fill="currentColor" aria-hidden="true" role="img" width="1em" height="1em">
                                            <path d="M96 184c39.8 0 72 32.2 72 72s-32.2 72-72 72-72-32.2-72-72 32.2-72 72-72zM24 80c0 39.8 32.2 72 72 72s72-32.2 72-72S135.8 8 96 8 24 40.2 24 80zm0 352c0 39.8 32.2 72 72 72s72-32.2 72-72-32.2-72-72-72-72 32.2-72 72z"></path>
                                        </svg>
                                    </span>
                                </button>
                            </div>
                            <div class="pf-v6-c-menu" hidden>
                                <div class="pf-v6-c-menu__content">
                                    <ul role="menu" class="pf-v6-c-menu__list">
                                        <li class="pf-v6-c-menu__list-item" role="none">
                                            <button tabindex="0" class="pf-v6-c-menu__item" role="menuitem" type="button" data-action="details">
                                                <span class="pf-v6-c-menu__item-main">
                                                    <span class="pf-v6-c-menu__item-text">Details</span>
                                                </span>
                                            </button>
                                        </li>
                                        <li class="pf-v6-c-menu__list-item" role="none">
                                            <button tabindex="-1" class="pf-v6-c-menu__item" role="menuitem" type="button" data-action="export">
                                                <span class="pf-v6-c-menu__item-main">
                                                    <span class="pf-v6-c-menu__item-text">Export</span>
                                                </span>
                                            </button>
                                        </li>
                                        <li class="pf-v6-c-menu__list-item pf-m-danger" role="none">
                                            <button tabindex="-1" class="pf-v6-c-menu__item" role="menuitem" type="button" data-action="destroy">
                                                <span class="pf-v6-c-menu__item-main">
                                                    <span class="pf-v6-c-menu__item-text">Destroy</span>
                                                </span>
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            `;

            // Toggle details
            const toggleBtn = row.querySelector('.pf-v6-c-table__toggle button');
            toggleBtn.addEventListener('click', () => {
                const isExpanded = row.classList.contains('expanded');
                if (isExpanded) {
                    this.collapsePoolRow(row);
                } else {
                    this.expandPoolRow(row, pool);
                }
            });

            // Actions menu
            const dropdown = row.querySelector('.menu-dropdown-wrapper');
            const toggle = dropdown?.querySelector('.pf-v6-c-menu-toggle__button');
            const menu = dropdown?.querySelector('.pf-v6-c-menu');
            
            if (toggle && menu) {
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isHidden = menu.hidden;
                    // Close all menus first
                    document.querySelectorAll('.pf-v6-c-menu').forEach(m => m.hidden = true);
                    document.querySelectorAll('.pf-v6-c-menu-toggle__button').forEach(t => t.setAttribute('aria-expanded', 'false'));
                    // Toggle this menu
                    if (isHidden) {
                        menu.hidden = false;
                        toggle.setAttribute('aria-expanded', 'true');
                    }
                });

                menu.querySelectorAll('[data-action]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        menu.hidden = true;
                        const action = btn.getAttribute('data-action');
                        this.handlePoolAction(pool, action);
                    });
                });
            }

            return row;
        }

        async expandPoolRow(row, pool) {
            row.classList.add('expanded');
            const toggleBtn = row.querySelector('.pf-v6-c-table__toggle button');
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-expanded', 'true');
            }
            const icon = row.querySelector('.pf-v6-c-table__toggle-icon .toggle-icon');
            if (icon) {
                icon.setAttribute('d', 'M143 352.3L7 216.3c-9.4-9.4-9.4-24.6 0-33.9l22.6-22.6c9.4-9.4 24.6-9.4 33.9 0l96.4 96.4 96.4-96.4c9.4-9.4 24.6-9.4 33.9 0l22.6 22.6c9.4 9.4 9.4 24.6 0 33.9l-136 136c-9.2 9.4-24.4 9.4-33.8 0z');
            }

            const detailsRow = document.createElement('tr');
            detailsRow.className = 'pf-v6-c-table__tr pf-v6-c-table__expandable-row';
            const poolId = Utils.generateId(pool.name);
            detailsRow.id = `expanded-content-${poolId}`;
            detailsRow.innerHTML = `
                <td tabindex="-1" class="pf-v6-c-table__td" colspan="9">
                    <div class="pf-v6-c-table__expandable-row-content">
                    <div class="pf-v6-c-tabs">
                        <ul class="pf-v6-c-tabs__list">
                            <li class="pf-v6-c-tabs__item pf-v6-m-current">
                                <button class="pf-v6-c-tabs__link" data-tab="filesystems">File Systems</button>
                            </li>
                            <li class="pf-v6-c-tabs__item">
                                <button class="pf-v6-c-tabs__link" data-tab="snapshots">Snapshots</button>
                            </li>
                            <li class="pf-v6-c-tabs__item">
                                <button class="pf-v6-c-tabs__link" data-tab="status">Status</button>
                            </li>
                        </ul>
                    </div>
                    <div class="tab-content">
                        <div class="tab-pane active" data-tab="filesystems">
                            <div class="pf-v6-c-spinner pf-v6-m-xl" role="progressbar" aria-valuetext="Loading...">
                                <span class="pf-v6-c-spinner__clipper"></span>
                                <span class="pf-v6-c-spinner__lead-ball"></span>
                                <span class="pf-v6-c-spinner__tail-ball"></span>
                            </div>
                        </div>
                        <div class="tab-pane" data-tab="snapshots" style="display: none;">
                            <div class="pf-v6-c-spinner pf-v6-m-xl" role="progressbar" aria-valuetext="Loading...">
                                <span class="pf-v6-c-spinner__clipper"></span>
                                <span class="pf-v6-c-spinner__lead-ball"></span>
                                <span class="pf-v6-c-spinner__tail-ball"></span>
                            </div>
                        </div>
                        <div class="tab-pane" data-tab="status" style="display: none;">
                            <div class="pf-v6-c-spinner pf-v6-m-xl" role="progressbar" aria-valuetext="Loading...">
                                <span class="pf-v6-c-spinner__clipper"></span>
                                <span class="pf-v6-c-spinner__lead-ball"></span>
                                <span class="pf-v6-c-spinner__tail-ball"></span>
                            </div>
                        </div>
                    </div>
                    </div>
                </td>
            `;

            row.parentNode.insertBefore(detailsRow, row.nextSibling);

            // Tab switching
            detailsRow.querySelectorAll('[data-tab]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tabName = btn.getAttribute('data-tab');
                    this.switchTab(detailsRow, tabName);
                });
            });

            // Load initial tab content
            await this.loadPoolTab(pool, 'filesystems', detailsRow);
        }

        collapsePoolRow(row) {
            row.classList.remove('expanded');
            const toggleBtn = row.querySelector('.pf-v6-c-table__toggle button');
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-expanded', 'false');
            }
            const icon = row.querySelector('.pf-v6-c-table__toggle-icon .toggle-icon');
            if (icon) {
                icon.setAttribute('d', 'M143 352.3L7 216.3c-9.4-9.4-9.4-24.6 0-33.9l22.6-22.6c9.4-9.4 24.6-9.4 33.9 0l96.4 96.4 96.4-96.4c9.4-9.4 24.6-9.4 33.9 0l22.6 22.6c9.4 9.4 9.4 24.6 0 33.9l-136 136c-9.2 9.4-24.4 9.4-33.8 0z');
            }
            const detailsRow = row.nextElementSibling;
            if (detailsRow && detailsRow.classList.contains('pf-v6-c-table__expandable-row')) {
                detailsRow.remove();
            }
        }

        switchTab(detailsRow, tabName) {
            // Update tab buttons
            detailsRow.querySelectorAll('.pf-v6-c-tabs__item').forEach(item => {
                item.classList.remove('pf-v6-m-current');
            });
            detailsRow.querySelector(`[data-tab="${tabName}"]`).closest('.pf-v6-c-tabs__item').classList.add('pf-v6-m-current');

            // Update content
            detailsRow.querySelectorAll('.tab-pane').forEach(pane => {
                pane.style.display = 'none';
            });
            const activePane = detailsRow.querySelector(`.tab-pane[data-tab="${tabName}"]`);
            activePane.style.display = 'block';

            // Load content if empty
            const pool = this.pools.find(p => p.id === detailsRow.previousElementSibling.getAttribute('data-pool-id'));
            if (pool && activePane.querySelector('.spinner')) {
                this.loadPoolTab(pool, tabName, detailsRow);
            }
        }

        async loadPoolTab(pool, tabName, detailsRow) {
            const pane = detailsRow.querySelector(`.tab-pane[data-tab="${tabName}"]`);
            
            if (tabName === 'filesystems') {
                await this.loadFileSystems(pool, pane);
            } else if (tabName === 'snapshots') {
                await this.loadSnapshots(pool, pane);
            } else if (tabName === 'status') {
                await this.loadPoolStatus(pool, pane);
            }
        }

        async loadFileSystems(pool, container) {
            try {
                const proc = cockpit.spawn(['zfs', 'list', '-H', '-o', 
                    'name,used,avail,refer,mountpoint,type,encryption'], pool.name);
                let output = '';

                proc.stream((data) => {
                    output += data;
                });

                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        const filesystems = this.parseFileSystemList(output);
                        this.renderFileSystems(filesystems, container, pool);
                    } else {
                        container.innerHTML = '<p class="text-danger">Failed to load file systems</p>';
                    }
                });

                proc.fail((error) => {
                    container.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error)}</p>`;
                });
            } catch (error) {
                container.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
            }
        }

        parseFileSystemList(data) {
            const lines = data.split('\n').filter(line => line.trim());
            return lines.map(line => {
                const parts = line.split('\t');
                return {
                    name: parts[0],
                    used: parts[1],
                    avail: parts[2],
                    refer: parts[3],
                    mountpoint: parts[4],
                    type: parts[5],
                    encryption: parts[6] || 'off'
                };
            });
        }

        renderFileSystems(filesystems, container, pool) {
            if (filesystems.length === 0) {
                container.innerHTML = '<p>No file systems found.</p>';
                return;
            }

            let html = `
                <div class="pf-v6-c-toolbar">
                    <div class="pf-v6-c-toolbar__content">
                        <div class="pf-v6-c-toolbar__content-section">
                            <button class="pf-v6-c-button pf-m-primary" data-action="create-filesystem">
                                <span class="pf-v6-c-button__text">Create File System</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="pf-v6-c-table">
                    <table class="pf-v6-c-table__table" role="table">
                        <thead>
                            <tr class="pf-v6-c-table__tr">
                                <th class="pf-v6-c-table__th">Name</th>
                                <th class="pf-v6-c-table__th">Used</th>
                                <th class="pf-v6-c-table__th">Available</th>
                                <th class="pf-v6-c-table__th">Referenced</th>
                                <th class="pf-v6-c-table__th">Mountpoint</th>
                                <th class="pf-v6-c-table__th">Type</th>
                                <th class="pf-v6-c-table__th">Encryption</th>
                                <th class="pf-v6-c-table__th">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="pf-v6-c-table__tbody">
            `;

            filesystems.forEach(fs => {
                html += `
                    <tr class="pf-v6-c-table__tr">
                        <td class="pf-v6-c-table__td">${Utils.escapeHtml(fs.name)}</td>
                        <td class="pf-v6-c-table__td">${Utils.escapeHtml(fs.used)}</td>
                        <td class="pf-v6-c-table__td">${Utils.escapeHtml(fs.avail)}</td>
                        <td class="pf-v6-c-table__td">${Utils.escapeHtml(fs.refer)}</td>
                        <td class="pf-v6-c-table__td">${Utils.escapeHtml(fs.mountpoint)}</td>
                        <td class="pf-v6-c-table__td">${Utils.escapeHtml(fs.type)}</td>
                        <td class="pf-v6-c-table__td">${fs.encryption !== 'off' ? '<span class="pf-v6-c-label pf-m-blue">Encrypted</span>' : '-'}</td>
                        <td class="pf-v6-c-table__td">
                            <div class="menu-dropdown-wrapper">
                                <div class="pf-v6-c-menu-toggle pf-m-plain">
                                    <button class="pf-v6-c-menu-toggle__button" type="button" aria-label="Actions" aria-expanded="false">
                                        <span class="pf-v6-c-menu-toggle__text">
                                            <svg class="pf-v6-svg" viewBox="0 0 192 512" fill="currentColor" aria-hidden="true" role="img" width="1em" height="1em">
                                                <path d="M96 184c39.8 0 72 32.2 72 72s-32.2 72-72 72-72-32.2-72-72 32.2-72 72-72zM24 80c0 39.8 32.2 72 72 72s72-32.2 72-72S135.8 8 96 8 24 40.2 24 80zm0 352c0 39.8 32.2 72 72 72s72-32.2 72-72-32.2-72-72-72-72 32.2-72 72z"></path>
                                            </svg>
                                        </span>
                                    </button>
                                </div>
                                <div class="pf-v6-c-menu" hidden>
                                    <div class="pf-v6-c-menu__content">
                                        <ul role="menu" class="pf-v6-c-menu__list">
                                            <li class="pf-v6-c-menu__list-item" role="none">
                                                <button tabindex="0" class="pf-v6-c-menu__item" role="menuitem" type="button" data-action="snapshot">
                                                    <span class="pf-v6-c-menu__item-main">
                                                        <span class="pf-v6-c-menu__item-text">Create Snapshot</span>
                                                    </span>
                                                </button>
                                            </li>
                                            <li class="pf-v6-c-menu__list-item" role="none">
                                                <button tabindex="-1" class="pf-v6-c-menu__item" role="menuitem" type="button" data-action="clone">
                                                    <span class="pf-v6-c-menu__item-main">
                                                        <span class="pf-v6-c-menu__item-text">Clone</span>
                                                    </span>
                                                </button>
                                            </li>
                                            <li class="pf-v6-c-menu__list-item pf-m-danger" role="none">
                                                <button tabindex="-1" class="pf-v6-c-menu__item" role="menuitem" type="button" data-action="destroy">
                                                    <span class="pf-v6-c-menu__item-main">
                                                        <span class="pf-v6-c-menu__item-text">Destroy</span>
                                                    </span>
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;

            // Add event listeners
            container.querySelector('[data-action="create-filesystem"]')?.addEventListener('click', () => {
                this.showCreateFileSystemModal(pool);
            });

            // Filesystem action dropdowns
            container.querySelectorAll('.menu-dropdown-wrapper').forEach(dropdown => {
                const toggle = dropdown.querySelector('.pf-v6-c-menu-toggle__button');
                const menu = dropdown.querySelector('.pf-v6-c-menu');
                
                if (toggle && menu) {
                    toggle.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isHidden = menu.hidden;
                        // Close all menus first
                        document.querySelectorAll('.pf-v6-c-menu').forEach(m => m.hidden = true);
                        document.querySelectorAll('.pf-v6-c-menu-toggle__button').forEach(t => t.setAttribute('aria-expanded', 'false'));
                        // Toggle this menu
                        if (isHidden) {
                            menu.hidden = false;
                            toggle.setAttribute('aria-expanded', 'true');
                        }
                    });

                    menu.querySelectorAll('[data-action]').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            menu.hidden = true;
                            const action = btn.getAttribute('data-action');
                            const row = btn.closest('tr');
                            const fsName = row.querySelector('td').textContent.trim();
                            this.handleFileSystemAction(fsName, action, pool);
                        });
                    });
                }
            });
        }

        async loadSnapshots(pool, container) {
            try {
                const proc = cockpit.spawn(['zfs', 'list', '-H', '-t', 'snapshot', '-o', 
                    'name,used,refer,creation'], pool.name);
                let output = '';

                proc.stream((data) => {
                    output += data;
                });

                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        const snapshots = this.parseSnapshotList(output);
                        this.renderSnapshots(snapshots, container, pool);
                    } else {
                        container.innerHTML = '<p class="text-danger">Failed to load snapshots</p>';
                    }
                });

                proc.fail((error) => {
                    container.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error)}</p>`;
                });
            } catch (error) {
                container.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
            }
        }

        parseSnapshotList(data) {
            const lines = data.split('\n').filter(line => line.trim());
            return lines.map(line => {
                const parts = line.split('\t');
                return {
                    name: parts[0],
                    used: parts[1],
                    refer: parts[2],
                    creation: parts[3]
                };
            });
        }

        renderSnapshots(snapshots, container, pool) {
            let html = `
                <div class="pf-v6-c-toolbar">
                    <div class="pf-v6-c-toolbar__content">
                        <div class="pf-v6-c-toolbar__content-section">
                            <button class="pf-v6-c-button pf-m-primary" data-action="create-snapshot">
                                <span class="pf-v6-c-button__text">Create Snapshot</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            if (snapshots.length === 0) {
                html += '<p>No snapshots found.</p>';
                container.innerHTML = html;
                container.querySelector('[data-action="create-snapshot"]')?.addEventListener('click', () => {
                    this.showCreateSnapshotModal(pool);
                });
                return;
            }

            html += `
                <div class="pf-v6-c-table">
                    <table class="pf-v6-c-table__table" role="table">
                        <thead>
                            <tr class="pf-v6-c-table__tr">
                                <th class="pf-v6-c-table__th">Name</th>
                                <th class="pf-v6-c-table__th">Used</th>
                                <th class="pf-v6-c-table__th">Referenced</th>
                                <th class="pf-v6-c-table__th">Creation</th>
                                <th class="pf-v6-c-table__th">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="pf-v6-c-table__tbody">
            `;

            snapshots.forEach(snap => {
                html += `
                    <tr class="pf-v6-c-table__tr">
                        <td class="pf-v6-c-table__td">${Utils.escapeHtml(snap.name)}</td>
                        <td class="pf-v6-c-table__td">${Utils.escapeHtml(snap.used)}</td>
                        <td class="pf-v6-c-table__td">${Utils.escapeHtml(snap.refer)}</td>
                        <td class="pf-v6-c-table__td">${Utils.escapeHtml(snap.creation)}</td>
                        <td class="pf-v6-c-table__td">
                            <div class="menu-dropdown-wrapper">
                                <div class="pf-v6-c-menu-toggle pf-m-plain">
                                    <button class="pf-v6-c-menu-toggle__button" type="button" aria-label="Actions" aria-expanded="false">
                                        <span class="pf-v6-c-menu-toggle__text">
                                            <svg class="pf-v6-svg" viewBox="0 0 192 512" fill="currentColor" aria-hidden="true" role="img" width="1em" height="1em">
                                                <path d="M96 184c39.8 0 72 32.2 72 72s-32.2 72-72 72-72-32.2-72-72 32.2-72 72-72zM24 80c0 39.8 32.2 72 72 72s72-32.2 72-72S135.8 8 96 8 24 40.2 24 80zm0 352c0 39.8 32.2 72 72 72s72-32.2 72-72-32.2-72-72-72-72 32.2-72 72z"></path>
                                            </svg>
                                        </span>
                                    </button>
                                </div>
                                <div class="pf-v6-c-menu" hidden>
                                    <div class="pf-v6-c-menu__content">
                                        <ul role="menu" class="pf-v6-c-menu__list">
                                            <li class="pf-v6-c-menu__list-item" role="none">
                                                <button tabindex="0" class="pf-v6-c-menu__item" role="menuitem" type="button" data-action="clone">
                                                    <span class="pf-v6-c-menu__item-main">
                                                        <span class="pf-v6-c-menu__item-text">Clone</span>
                                                    </span>
                                                </button>
                                            </li>
                                            <li class="pf-v6-c-menu__list-item" role="none">
                                                <button tabindex="-1" class="pf-v6-c-menu__item" role="menuitem" type="button" data-action="rollback">
                                                    <span class="pf-v6-c-menu__item-main">
                                                        <span class="pf-v6-c-menu__item-text">Rollback</span>
                                                    </span>
                                                </button>
                                            </li>
                                            <li class="pf-v6-c-menu__list-item pf-m-danger" role="none">
                                                <button tabindex="-1" class="pf-v6-c-menu__item" role="menuitem" type="button" data-action="destroy">
                                                    <span class="pf-v6-c-menu__item-main">
                                                        <span class="pf-v6-c-menu__item-text">Destroy</span>
                                                    </span>
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;

            // Add event listeners
            container.querySelector('[data-action="create-snapshot"]')?.addEventListener('click', () => {
                this.showCreateSnapshotModal(pool);
            });

            // Snapshot action dropdowns
            container.querySelectorAll('.menu-dropdown-wrapper').forEach(dropdown => {
                const toggle = dropdown.querySelector('.pf-v6-c-menu-toggle__button');
                const menu = dropdown.querySelector('.pf-v6-c-menu');
                
                if (toggle && menu) {
                    toggle.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isHidden = menu.hidden;
                        // Close all menus first
                        document.querySelectorAll('.pf-v6-c-menu').forEach(m => m.hidden = true);
                        document.querySelectorAll('.pf-v6-c-menu-toggle__button').forEach(t => t.setAttribute('aria-expanded', 'false'));
                        // Toggle this menu
                        if (isHidden) {
                            menu.hidden = false;
                            toggle.setAttribute('aria-expanded', 'true');
                        }
                    });

                    menu.querySelectorAll('[data-action]').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            menu.hidden = true;
                            const action = btn.getAttribute('data-action');
                            const row = btn.closest('tr');
                            const snapName = row.querySelector('td').textContent.trim();
                            this.handleSnapshotAction(snapName, action);
                        });
                    });
                }
            });
        }

        async loadPoolStatus(pool, container) {
            try {
                const proc = cockpit.spawn(['zpool', 'status', pool.name]);
                let output = '';

                proc.stream((data) => {
                    output += data;
                });

                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        container.innerHTML = `<pre class="pf-v6-c-code-block">${Utils.escapeHtml(output)}</pre>`;
                    } else {
                        container.innerHTML = '<p class="text-danger">Failed to load status</p>';
                    }
                });

                proc.fail((error) => {
                    container.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error)}</p>`;
                });
            } catch (error) {
                container.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
            }
        }

        handlePoolAction(pool, action) {
            switch (action) {
                case 'details':
                    this.showPoolDetails(pool);
                    break;
                case 'export':
                    this.exportPool(pool);
                    break;
                case 'destroy':
                    this.destroyPool(pool);
                    break;
            }
        }

        showPoolDetails(pool) {
            const modal = new Modal(`Pool Details: ${pool.name}`, 
                `<pre class="pf-v6-c-code-block">Loading...</pre>`, 
                { footer: false });
            modal.show();

            const proc = cockpit.spawn(['zpool', 'status', pool.name]);
            let output = '';
            proc.stream((data) => output += data);
            proc.done(() => {
                modal.modal.querySelector('.pf-v6-c-code-block').textContent = output;
            });
        }

        async showCreatePoolModal() {
            // Load available disks
            const disks = await this.listAvailableDisks();
            
            const content = `
                <form id="create-pool-form">
                    <div class="pf-v6-c-form__group">
                        <label class="pf-v6-c-form__label" for="pool-name">
                            <span class="pf-v6-c-form__label-text">Pool Name</span>
                        </label>
                        <input class="pf-v6-c-form-control" type="text" id="pool-name" name="name" required>
                    </div>
                    <div class="pf-v6-c-form__group">
                        <label class="pf-v6-c-form__label" for="pool-vdev-type">
                            <span class="pf-v6-c-form__label-text">VDEV Type</span>
                        </label>
                        <select class="pf-v6-c-form-control" id="pool-vdev-type" name="vdevType" required>
                            <option value="stripe">Stripe (No redundancy)</option>
                            <option value="mirror">Mirror</option>
                            <option value="raidz">RAID-Z (single parity)</option>
                            <option value="raidz2">RAID-Z2 (double parity)</option>
                            <option value="raidz3">RAID-Z3 (triple parity)</option>
                        </select>
                    </div>
                    <div class="pf-v6-c-form__group">
                        <label class="pf-v6-c-form__label">
                            <span class="pf-v6-c-form__label-text">Select Devices</span>
                        </label>
                        <div id="pool-devices-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--pf-t--global--border--color--default); border-radius: var(--pf-t--global--border--radius--small); padding: var(--pf-t--global--spacer--sm);">
                            ${disks.length > 0 ? disks.map(disk => `
                                <div class="pf-v6-c-check" style="margin-bottom: var(--pf-t--global--spacer--xs);">
                                    <input class="pf-v6-c-check__input" type="checkbox" id="disk-${disk.replace(/\//g, '-')}" name="devices" value="${disk}">
                                    <label class="pf-v6-c-check__label" for="disk-${disk.replace(/\//g, '-')}">
                                        <span class="pf-v6-c-check__label-text">${Utils.escapeHtml(disk)}</span>
                                    </label>
                                </div>
                            `).join('') : '<div class="pf-v6-c-empty-state"><div class="pf-v6-c-empty-state__content">No available disks found</div></div>'}
                        </div>
                        <div class="pf-v6-c-form__helper-text">Select one or more devices to use for the storage pool</div>
                    </div>
                </form>
            `;

            const modal = new Modal('Create Storage Pool', content, {
                onConfirm: () => {
                    const form = document.getElementById('create-pool-form');
                    const formData = new FormData(form);
                    const name = formData.get('name');
                    const vdevType = formData.get('vdevType');
                    const selectedDevices = Array.from(form.querySelectorAll('input[name="devices"]:checked')).map(cb => cb.value);

                    if (!name || selectedDevices.length === 0 || !vdevType) {
                        Utils.showNotification('warning', 'Validation Error', 'Please fill in all required fields and select at least one device');
                        return false;
                    }

                    // Validate device count for mirrors
                    if (vdevType === 'mirror' && selectedDevices.length < 2) {
                        Utils.showNotification('warning', 'Validation Error', 'Mirror requires at least 2 devices');
                        return false;
                    }

                    this.createPool(name, selectedDevices, vdevType);
                    return true;
                }
            });
            modal.show();
        }

        async listAvailableDisks() {
            return new Promise((resolve, reject) => {
                const disks = [];
                
                // Use lsblk to get block devices, filtering out partitions and loop devices
                // -e 7,11 excludes loop devices (7) and ROM devices (11)
                const proc = cockpit.spawn(['lsblk', '-nd', '-o', 'NAME,TYPE', '-e', '7,11'], { err: 'message' });
                
                proc.stream((data) => {
                    const lines = data.split('\n');
                    lines.forEach(line => {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 2) {
                            const name = parts[0];
                            const type = parts[1];
                            // Only include disks (not partitions, loop, etc.)
                            // lsblk already filters loop devices via -e flag, but double-check
                            if (type === 'disk' && !name.startsWith('loop') && !name.startsWith('ram')) {
                                // Use the device name directly from lsblk
                                disks.push(`/dev/${name}`);
                            }
                        }
                    });
                });
                
                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        // Sort disks alphabetically
                        disks.sort();
                        resolve(disks);
                    } else {
                        // Fallback: try listing /dev directly using lsblk with different options
                        this.listDisksFallback().then(resolve).catch(reject);
                    }
                });
                
                proc.fail((error) => {
                    // Fallback: try listing /dev directly
                    this.listDisksFallback().then(resolve).catch(() => {
                        reject(new Error('Failed to list disks: ' + error));
                    });
                });
            });
        }

        async listDisksFallback() {
            return new Promise((resolve, reject) => {
                const disks = [];
                
                // Fallback: use lsblk without filters, or list /dev/disk/by-id
                const proc = cockpit.spawn(['sh', '-c', 'lsblk -nd -o NAME,TYPE 2>/dev/null | awk \'$2=="disk" && $1!~/^loop/ && $1!~/^ram/ {print "/dev/"$1}\''], { err: 'message' });
                
                proc.stream((data) => {
                    const lines = data.split('\n');
                    lines.forEach(line => {
                        const device = line.trim();
                        if (device && device.startsWith('/dev/')) {
                            disks.push(device);
                        }
                    });
                });
                
                proc.done((exitCode) => {
                    disks.sort();
                    resolve(disks);
                });
                
                proc.fail((error) => {
                    // If lsblk fails completely, return empty array
                    resolve([]);
                });
            });
        }

        async createPool(name, devices, vdevType) {
            try {
                const args = ['zpool', 'create', name];
                
                // Add vdev type if not stripe
                if (vdevType !== 'stripe') {
                    args.push(vdevType);
                }
                
                // Add devices
                args.push(...devices);

                const proc = cockpit.spawn(args);
                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        Utils.showNotification('success', 'Success', `Pool ${name} created successfully`);
                        this.loadPools();
                    } else {
                        Utils.showNotification('danger', 'Error', 'Failed to create pool');
                    }
                });
                proc.fail((error) => {
                    Utils.showNotification('danger', 'Error', 'Failed to create pool: ' + error);
                });
            } catch (error) {
                Utils.showNotification('danger', 'Error', error.message);
            }
        }

        showImportPoolModal() {
            const content = `
                <form id="import-pool-form">
                    <div class="pf-v6-c-form__group">
                        <label class="pf-v6-c-form__label" for="import-pool-name">
                            <span class="pf-v6-c-form__label-text">Pool Name (optional)</span>
                        </label>
                        <input class="pf-v6-c-form-control" type="text" id="import-pool-name" name="name">
                        <div class="pf-v6-c-form__helper-text">Leave empty to import all available pools</div>
                    </div>
                </form>
            `;

            const modal = new Modal('Import Storage Pool', content, {
                onConfirm: () => {
                    const form = document.getElementById('import-pool-form');
                    const formData = new FormData(form);
                    const name = formData.get('name');

                    this.importPool(name || null);
                    return true;
                }
            });
            modal.show();
        }

        async importPool(name) {
            try {
                const args = ['zpool', 'import'];
                if (name) {
                    args.push(name);
                }

                const proc = cockpit.spawn(args);
                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        Utils.showNotification('success', 'Success', 'Pool imported successfully');
                        this.loadPools();
                    } else {
                        Utils.showNotification('danger', 'Error', 'Failed to import pool');
                    }
                });
                proc.fail((error) => {
                    Utils.showNotification('danger', 'Error', 'Failed to import pool: ' + error);
                });
            } catch (error) {
                Utils.showNotification('danger', 'Error', error.message);
            }
        }

        showCreateFileSystemModal(pool) {
            const content = `
                <form id="create-filesystem-form">
                    <div class="pf-v6-c-form__group">
                        <label class="pf-v6-c-form__label" for="fs-name">
                            <span class="pf-v6-c-form__label-text">File System Name</span>
                        </label>
                        <input class="pf-v6-c-form-control" type="text" id="fs-name" name="name" 
                               placeholder="${pool.name}/" required>
                    </div>
                    <div class="pf-v6-c-form__group">
                        <label class="pf-v6-c-form__label">
                            <input type="checkbox" id="fs-encrypted" name="encrypted"> Encrypted
                        </label>
                    </div>
                    <div class="pf-v6-c-form__group" id="fs-passphrase-group" style="display: none;">
                        <label class="pf-v6-c-form__label" for="fs-passphrase">
                            <span class="pf-v6-c-form__label-text">Passphrase</span>
                        </label>
                        <input class="pf-v6-c-form-control" type="password" id="fs-passphrase" name="passphrase">
                    </div>
                </form>
            `;

            const modal = new Modal('Create File System', content, {
                onConfirm: () => {
                    const form = document.getElementById('create-filesystem-form');
                    const formData = new FormData(form);
                    const name = formData.get('name');
                    const encrypted = formData.get('encrypted');
                    const passphrase = formData.get('passphrase');

                    if (!name) {
                        Utils.showNotification('warning', 'Validation Error', 'Please enter a file system name');
                        return false;
                    }

                    if (encrypted && !passphrase) {
                        Utils.showNotification('warning', 'Validation Error', 'Please enter a passphrase for encrypted file system');
                        return false;
                    }

                    this.createFileSystem(name, encrypted, passphrase);
                    return true;
                }
            });
            modal.show();

            // Show/hide passphrase field based on encryption checkbox
            document.getElementById('fs-encrypted').addEventListener('change', (e) => {
                document.getElementById('fs-passphrase-group').style.display = e.target.checked ? 'block' : 'none';
            });
        }

        async createFileSystem(name, encrypted, passphrase) {
            try {
                const args = ['zfs', 'create'];
                if (encrypted) {
                    args.push('-o', 'encryption=aes-256-gcm', '-o', 'keyformat=passphrase', '-o', 'keylocation=prompt');
                }
                args.push(name);

                const proc = cockpit.spawn(args);
                
                // If encrypted, send passphrase via stdin
                if (encrypted && passphrase) {
                    proc.input(passphrase + '\n');
                }

                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        Utils.showNotification('success', 'Success', `File system ${name} created successfully`);
                        // Refresh the file systems tab
                        const poolName = name.split('/')[0];
                        const row = document.querySelector(`[data-pool-name="${poolName}"]`);
                        if (row && row.classList.contains('expanded')) {
                            const detailsRow = row.nextElementSibling;
                            if (detailsRow) {
                                const pane = detailsRow.querySelector('.tab-pane[data-tab="filesystems"]');
                                if (pane) {
                                    const pool = this.pools.find(p => p.name === poolName);
                                    if (pool) {
                                        this.loadFileSystems(pool, pane);
                                    }
                                }
                            }
                        }
                    } else {
                        Utils.showNotification('danger', 'Error', 'Failed to create file system');
                    }
                });
                proc.fail((error) => {
                    Utils.showNotification('danger', 'Error', 'Failed to create file system: ' + error);
                });
            } catch (error) {
                Utils.showNotification('danger', 'Error', error.message);
            }
        }

        showUnlockFileSystemsModal() {
            const content = `
                <form id="unlock-filesystems-form">
                    <div class="pf-v6-c-form__group">
                        <label class="pf-v6-c-form__label" for="unlock-pool">
                            <span class="pf-v6-c-form__label-text">Pool Name</span>
                        </label>
                        <select class="pf-v6-c-form-control" id="unlock-pool" name="pool" required>
                            <option value="">Select a pool...</option>
                            ${this.pools.map(p => `<option value="${Utils.escapeHtml(p.name)}">${Utils.escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="pf-v6-c-form__group">
                        <label class="pf-v6-c-form__label" for="unlock-passphrase">
                            <span class="pf-v6-c-form__label-text">Passphrase</span>
                        </label>
                        <input class="pf-v6-c-form-control" type="password" id="unlock-passphrase" name="passphrase" required>
                    </div>
                </form>
            `;

            const modal = new Modal('Unlock Encrypted File Systems', content, {
                onConfirm: () => {
                    const form = document.getElementById('unlock-filesystems-form');
                    const formData = new FormData(form);
                    const pool = formData.get('pool');
                    const passphrase = formData.get('passphrase');

                    if (!pool || !passphrase) {
                        Utils.showNotification('warning', 'Validation Error', 'Please fill in all fields');
                        return false;
                    }

                    this.unlockFileSystems(pool, passphrase);
                    return true;
                }
            });
            modal.show();
        }

        async unlockFileSystems(poolName, passphrase) {
            try {
                const proc = cockpit.spawn(['zfs', 'load-key', poolName]);
                proc.input(passphrase + '\n');
                
                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        Utils.showNotification('success', 'Success', `File systems in pool ${poolName} unlocked successfully`);
                        // Mount the filesystems
                        cockpit.spawn(['zfs', 'mount', '-a']).done(() => {
                            this.loadPools();
                        });
                    } else {
                        Utils.showNotification('danger', 'Error', 'Failed to unlock file systems');
                    }
                });
                proc.fail((error) => {
                    Utils.showNotification('danger', 'Error', 'Failed to unlock file systems: ' + error);
                });
            } catch (error) {
                Utils.showNotification('danger', 'Error', error.message);
            }
        }

        showConfigureModal() {
            const content = `
                <div class="pf-v6-c-alert pf-m-info">
                    <h4 class="pf-v6-c-alert__title">Configuration</h4>
                    <div class="pf-v6-c-alert__description">
                        <p>Configuration options will be available in a future release.</p>
                    </div>
                </div>
            `;

            const modal = new Modal('Configure Cockpit ZFS Manager', content);
            modal.show();
        }

        showAboutModal() {
            const content = `
                <div>
                    <h3>Cockpit ZFS Manager</h3>
                    <p>Version 0.1.0</p>
                    <p>A modern ZFS management interface for Cockpit.</p>
                    <p>Built with vanilla JavaScript and PatternFly styling.</p>
                </div>
            `;

            const modal = new Modal('About Cockpit ZFS Manager', content);
            modal.show();
        }

        handleFileSystemAction(fsName, action, pool) {
            switch (action) {
                case 'snapshot':
                    this.showCreateSnapshotModal(pool, fsName);
                    break;
                case 'clone':
                    this.showCloneFileSystemModal(fsName);
                    break;
                case 'destroy':
                    this.destroyFileSystem(fsName);
                    break;
            }
        }

        handleSnapshotAction(snapName, action) {
            switch (action) {
                case 'clone':
                    this.showCloneSnapshotModal(snapName);
                    break;
                case 'rollback':
                    this.rollbackSnapshot(snapName);
                    break;
                case 'destroy':
                    this.destroySnapshot(snapName);
                    break;
            }
        }

        showCreateSnapshotModal(pool, filesystem = null) {
            const content = `
                <form id="create-snapshot-form">
                    <div class="pf-v6-c-form__group">
                        <label class="pf-v6-c-form__label" for="snapshot-name">
                            <span class="pf-v6-c-form__label-text">Snapshot Name</span>
                        </label>
                        <input class="pf-v6-c-form-control" type="text" id="snapshot-name" name="name" 
                               placeholder="${filesystem || pool.name}@snapshot-name" required>
                        <div class="pf-v6-c-form__helper-text">Format: filesystem@snapshot-name</div>
                    </div>
                </form>
            `;

            const modal = new Modal('Create Snapshot', content, {
                onConfirm: () => {
                    const form = document.getElementById('create-snapshot-form');
                    const formData = new FormData(form);
                    const name = formData.get('name');

                    if (!name || !name.includes('@')) {
                        Utils.showNotification('warning', 'Validation Error', 'Snapshot name must be in format: filesystem@snapshot-name');
                        return false;
                    }

                    this.createSnapshot(name);
                    return true;
                }
            });
            modal.show();
        }

        async createSnapshot(name) {
            try {
                const proc = cockpit.spawn(['zfs', 'snapshot', name]);
                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        Utils.showNotification('success', 'Success', `Snapshot ${name} created successfully`);
                        // Refresh snapshots tab
                        const poolName = name.split('@')[0].split('/')[0];
                        const row = document.querySelector(`[data-pool-name="${poolName}"]`);
                        if (row && row.classList.contains('expanded')) {
                            const detailsRow = row.nextElementSibling;
                            if (detailsRow) {
                                const pane = detailsRow.querySelector('.tab-pane[data-tab="snapshots"]');
                                if (pane) {
                                    const pool = this.pools.find(p => p.name === poolName);
                                    if (pool) {
                                        this.loadSnapshots(pool, pane);
                                    }
                                }
                            }
                        }
                    } else {
                        Utils.showNotification('danger', 'Error', 'Failed to create snapshot');
                    }
                });
                proc.fail((error) => {
                    Utils.showNotification('danger', 'Error', 'Failed to create snapshot: ' + error);
                });
            } catch (error) {
                Utils.showNotification('danger', 'Error', error.message);
            }
        }

        showCloneFileSystemModal(fsName) {
            const content = `
                <form id="clone-filesystem-form">
                    <div class="pf-v6-c-form__group">
                        <label class="pf-v6-c-form__label" for="clone-name">
                            <span class="pf-v6-c-form__label-text">Clone Name</span>
                        </label>
                        <input class="pf-v6-c-form-control" type="text" id="clone-name" name="name" required>
                        <div class="pf-v6-c-form__helper-text">Name for the cloned file system</div>
                    </div>
                </form>
            `;

            const modal = new Modal('Clone File System', content, {
                onConfirm: () => {
                    const form = document.getElementById('clone-filesystem-form');
                    const formData = new FormData(form);
                    const cloneName = formData.get('name');

                    if (!cloneName) {
                        Utils.showNotification('warning', 'Validation Error', 'Please enter a clone name');
                        return false;
                    }

                    this.cloneFileSystem(fsName, cloneName);
                    return true;
                }
            });
            modal.show();
        }

        async cloneFileSystem(source, target) {
            try {
                const proc = cockpit.spawn(['zfs', 'clone', source, target]);
                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        Utils.showNotification('success', 'Success', `File system cloned successfully`);
                        this.loadPools();
                    } else {
                        Utils.showNotification('danger', 'Error', 'Failed to clone file system');
                    }
                });
                proc.fail((error) => {
                    Utils.showNotification('danger', 'Error', 'Failed to clone file system: ' + error);
                });
            } catch (error) {
                Utils.showNotification('danger', 'Error', error.message);
            }
        }

        showCloneSnapshotModal(snapName) {
            const content = `
                <form id="clone-snapshot-form">
                    <div class="pf-v6-c-form__group">
                        <label class="pf-v6-c-form__label" for="clone-snapshot-name">
                            <span class="pf-v6-c-form__label-text">Clone Name</span>
                        </label>
                        <input class="pf-v6-c-form-control" type="text" id="clone-snapshot-name" name="name" required>
                        <div class="pf-v6-c-form__helper-text">Name for the cloned file system from snapshot</div>
                    </div>
                </form>
            `;

            const modal = new Modal('Clone Snapshot', content, {
                onConfirm: () => {
                    const form = document.getElementById('clone-snapshot-form');
                    const formData = new FormData(form);
                    const cloneName = formData.get('name');

                    if (!cloneName) {
                        Utils.showNotification('warning', 'Validation Error', 'Please enter a clone name');
                        return false;
                    }

                    this.cloneSnapshot(snapName, cloneName);
                    return true;
                }
            });
            modal.show();
        }

        async cloneSnapshot(source, target) {
            try {
                const proc = cockpit.spawn(['zfs', 'clone', source, target]);
                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        Utils.showNotification('success', 'Success', `Snapshot cloned successfully`);
                        this.loadPools();
                    } else {
                        Utils.showNotification('danger', 'Error', 'Failed to clone snapshot');
                    }
                });
                proc.fail((error) => {
                    Utils.showNotification('danger', 'Error', 'Failed to clone snapshot: ' + error);
                });
            } catch (error) {
                Utils.showNotification('danger', 'Error', error.message);
            }
        }

        async rollbackSnapshot(snapName) {
            if (!confirm(`WARNING: This will rollback to snapshot ${snapName}. All changes since this snapshot will be lost!\n\nAre you sure?`)) {
                return;
            }

            try {
                const proc = cockpit.spawn(['zfs', 'rollback', '-r', snapName]);
                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        Utils.showNotification('success', 'Success', `Rolled back to snapshot ${snapName}`);
                        this.loadPools();
                    } else {
                        Utils.showNotification('danger', 'Error', 'Failed to rollback snapshot');
                    }
                });
                proc.fail((error) => {
                    Utils.showNotification('danger', 'Error', 'Failed to rollback snapshot: ' + error);
                });
            } catch (error) {
                Utils.showNotification('danger', 'Error', error.message);
            }
        }

        async destroyFileSystem(fsName) {
            if (!confirm(`WARNING: This will destroy file system ${fsName} and all its data. This cannot be undone!\n\nAre you sure?`)) {
                return;
            }

            try {
                const proc = cockpit.spawn(['zfs', 'destroy', '-r', fsName]);
                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        Utils.showNotification('success', 'Success', `File system ${fsName} destroyed`);
                        this.loadPools();
                    } else {
                        Utils.showNotification('danger', 'Error', 'Failed to destroy file system');
                    }
                });
                proc.fail((error) => {
                    Utils.showNotification('danger', 'Error', 'Failed to destroy file system: ' + error);
                });
            } catch (error) {
                Utils.showNotification('danger', 'Error', error.message);
            }
        }

        async destroySnapshot(snapName) {
            if (!confirm(`Are you sure you want to destroy snapshot ${snapName}?`)) {
                return;
            }

            try {
                const proc = cockpit.spawn(['zfs', 'destroy', snapName]);
                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        Utils.showNotification('success', 'Success', `Snapshot ${snapName} destroyed`);
                        // Refresh snapshots tab
                        const poolName = snapName.split('@')[0].split('/')[0];
                        const row = document.querySelector(`[data-pool-name="${poolName}"]`);
                        if (row && row.classList.contains('expanded')) {
                            const detailsRow = row.nextElementSibling;
                            if (detailsRow) {
                                const pane = detailsRow.querySelector('.tab-pane[data-tab="snapshots"]');
                                if (pane) {
                                    const pool = this.pools.find(p => p.name === poolName);
                                    if (pool) {
                                        this.loadSnapshots(pool, pane);
                                    }
                                }
                            }
                        }
                    } else {
                        Utils.showNotification('danger', 'Error', 'Failed to destroy snapshot');
                    }
                });
                proc.fail((error) => {
                    Utils.showNotification('danger', 'Error', 'Failed to destroy snapshot: ' + error);
                });
            } catch (error) {
                Utils.showNotification('danger', 'Error', error.message);
            }
        }

        async exportPool(pool) {
            if (!confirm(`Are you sure you want to export pool ${pool.name}?`)) {
                return;
            }

            try {
                const proc = cockpit.spawn(['zpool', 'export', pool.name]);
                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        Utils.showNotification('success', 'Success', `Pool ${pool.name} exported successfully`);
                        this.loadPools();
                    } else {
                        Utils.showNotification('danger', 'Error', 'Failed to export pool');
                    }
                });
                proc.fail((error) => {
                    Utils.showNotification('danger', 'Error', 'Failed to export pool: ' + error);
                });
            } catch (error) {
                Utils.showNotification('danger', 'Error', error.message);
            }
        }

        async destroyPool(pool) {
            if (!confirm(`WARNING: This will destroy pool ${pool.name} and all its data. This cannot be undone!\n\nAre you absolutely sure?`)) {
                return;
            }

            try {
                const proc = cockpit.spawn(['zpool', 'destroy', pool.name]);
                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        Utils.showNotification('success', 'Success', `Pool ${pool.name} destroyed`);
                        this.loadPools();
                    } else {
                        Utils.showNotification('danger', 'Error', 'Failed to destroy pool');
                    }
                });
                proc.fail((error) => {
                    Utils.showNotification('danger', 'Error', 'Failed to destroy pool: ' + error);
                });
            } catch (error) {
                Utils.showNotification('danger', 'Error', error.message);
            }
        }

        showLoading() {
            const spinner = document.getElementById('spinner-storagepools');
            if (spinner) {
                spinner.style.display = '';
            }
        }
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        window.zfsManager = new ZFSManager();
    });
})();
