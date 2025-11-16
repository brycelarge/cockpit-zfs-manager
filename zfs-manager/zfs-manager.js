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
            const icon = status === 'success' ? 'fa-check-circle' :
                        status === 'warning' ? 'fa-exclamation-triangle' :
                        status === 'danger' ? 'fa-times-circle' : 'fa-info-circle';

            const alert = document.createElement('div');
            alert.id = alertId;
            alert.className = `pf-c-alert ${statusClass}`;
            alert.innerHTML = `
                <div class="pf-c-alert__icon">
                    <i class="fa ${icon}" aria-hidden="true"></i>
                </div>
                <h4 class="pf-c-alert__title">${this.escapeHtml(title)}</h4>
                ${description ? `<div class="pf-c-alert__description"><p>${this.escapeHtml(description)}</p></div>` : ''}
                <div class="pf-c-alert__action">
                    <button class="pf-c-button pf-m-plain" type="button" aria-label="Close">
                        <i class="fa fa-times" aria-hidden="true"></i>
                    </button>
                </div>
            `;

            alertContainer.appendChild(alert);

            alert.querySelector('.pf-c-button').addEventListener('click', () => {
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
                this.backdrop.className = 'pf-c-backdrop';
                this.backdrop.style.display = 'block';

                this.modal = document.createElement('div');
                this.modal.className = 'pf-c-modal-box';
                this.modal.setAttribute('role', 'dialog');
                this.modal.innerHTML = `
                    <div class="pf-c-modal-box__header">
                        <h1 class="pf-c-modal-box__title">${Utils.escapeHtml(this.title)}</h1>
                        <button class="pf-c-button pf-m-plain" type="button" aria-label="Close dialog">
                            <i class="fa fa-times" aria-hidden="true"></i>
                        </button>
                    </div>
                    <div class="pf-c-modal-box__body">
                        ${this.content}
                    </div>
                    ${this.options.footer !== false ? `
                    <div class="pf-c-modal-box__footer">
                        ${this.options.footer || `
                            <button class="pf-c-button pf-m-primary" type="button">${this.options.confirmText || 'OK'}</button>
                            <button class="pf-c-button pf-m-link" type="button">Cancel</button>
                        `}
                    </div>
                    ` : ''}
                `;

                document.body.appendChild(this.backdrop);
                document.body.appendChild(this.modal);

                const closeBtn = this.modal.querySelector('.pf-c-button[aria-label="Close dialog"]');
                const cancelBtn = this.modal.querySelector('.pf-c-button.pf-m-link');
                const confirmBtn = this.modal.querySelector('.pf-c-button.pf-m-primary');

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
            this.container = document.getElementById('container');
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
                    <div class="pf-c-alert pf-m-danger">
                        <div class="pf-c-alert__icon">
                            <i class="fa fa-times-circle" aria-hidden="true"></i>
                        </div>
                        <h4 class="pf-c-alert__title">ZFS not found</h4>
                        <div class="pf-c-alert__description">
                            <p>ZFS tools are not installed. Please install zfsutils-linux (Debian/Ubuntu) or zfs (Fedora/RHEL).</p>
                        </div>
                    </div>
                `;
            });
            proc.done(() => {
                this.container.classList.remove('hidden');
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
            const dropdownToggle = document.querySelector('.pf-c-dropdown__toggle');
            if (dropdownToggle) {
                dropdownToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const menu = dropdownToggle.nextElementSibling;
                    if (menu) {
                        menu.hidden = !menu.hidden;
                    }
                });
            }

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.pf-c-dropdown')) {
                    document.querySelectorAll('.pf-c-dropdown__menu').forEach(menu => {
                        menu.hidden = true;
                    });
                }
            });
        }

        async loadPools() {
            try {
                this.showLoading();

                const proc = cockpit.spawn(['zpool', 'list', '-H', '-o', 
                    'name,size,allocated,free,fragmentation,health,readonly']);
                let output = '';

                proc.stream((data) => {
                    output += data;
                });

                proc.done((exitCode) => {
                    if (exitCode === 0) {
                        this.pools = this.parsePoolList(output);
                        this.renderPools();
                    } else {
                        Utils.showNotification('danger', 'Error', 'Failed to list ZFS pools');
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
                    <tr class="pf-c-table__tr">
                        <td colspan="11" class="pf-c-table__td pf-m-center">
                            <div class="pf-c-empty-state">
                                <div class="pf-c-empty-state__content">
                                    <i class="fa fa-database pf-c-empty-state__icon" aria-hidden="true"></i>
                                    <h2 class="pf-c-empty-state__title">No storage pools found</h2>
                                    <p class="pf-c-empty-state__body">Create a new storage pool to get started.</p>
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
            row.className = 'pf-c-table__tr listing-ct-item';
            row.setAttribute('data-pool-name', pool.name);
            row.setAttribute('data-pool-id', pool.id);

            const healthClass = pool.health === 'ONLINE' ? 'pf-m-success' : 
                              pool.health === 'DEGRADED' ? 'pf-m-warning' : 'pf-m-danger';
            const healthIcon = pool.health === 'ONLINE' ? 'fa-check-circle' :
                             pool.health === 'DEGRADED' ? 'fa-exclamation-triangle' : 'fa-times-circle';

            row.innerHTML = `
                <td class="pf-c-table__td listing-ct-toggle">
                    <button class="pf-c-button pf-m-plain" type="button" aria-label="Toggle details">
                        <i class="fa fa-angle-right" aria-hidden="true"></i>
                    </button>
                </td>
                <td class="pf-c-table__td" colspan="2"><strong>${Utils.escapeHtml(pool.name)}</strong></td>
                <td class="pf-c-table__td">
                    <span class="pf-c-label ${healthClass}">
                        <i class="fa ${healthIcon}" aria-hidden="true"></i>
                        ${Utils.escapeHtml(pool.health)}
                    </span>
                </td>
                <td class="pf-c-table__td">${Utils.escapeHtml(pool.size)}</td>
                <td class="pf-c-table__td">${Utils.escapeHtml(pool.allocated)}</td>
                <td class="pf-c-table__td">${Utils.escapeHtml(pool.free)}</td>
                <td class="pf-c-table__td">${Utils.escapeHtml(pool.fragmentation)}</td>
                <td class="pf-c-table__td">
                    <div class="pf-c-progress">
                        <div class="pf-c-progress__bar" role="progressbar" 
                             aria-valuenow="${pool.usage}" 
                             aria-valuemin="0" 
                             aria-valuemax="100">
                            <div style="width: ${pool.usage}%"></div>
                        </div>
                        <span class="pf-c-progress__measure">${pool.usage}%</span>
                    </div>
                </td>
                <td class="pf-c-table__td listing-ct-icon"></td>
                <td class="pf-c-table__td listing-ct-actionsmenu">
                    <div class="pf-c-dropdown">
                        <button class="pf-c-dropdown__toggle pf-m-plain" type="button" aria-label="Actions">
                            <i class="fa fa-ellipsis-v" aria-hidden="true"></i>
                        </button>
                        <ul class="pf-c-dropdown__menu" hidden>
                            <li><button class="pf-c-dropdown__menu-item" data-action="details">Details</button></li>
                            <li><button class="pf-c-dropdown__menu-item" data-action="export">Export</button></li>
                            <li><button class="pf-c-dropdown__menu-item pf-m-danger" data-action="destroy">Destroy</button></li>
                        </ul>
                    </div>
                </td>
            `;

            // Toggle details
            const toggleBtn = row.querySelector('.listing-ct-toggle button');
            toggleBtn.addEventListener('click', () => {
                const isExpanded = row.classList.contains('expanded');
                if (isExpanded) {
                    this.collapsePoolRow(row);
                } else {
                    this.expandPoolRow(row, pool);
                }
            });

            // Actions menu
            const dropdown = row.querySelector('.pf-c-dropdown');
            const toggle = dropdown?.querySelector('.pf-c-dropdown__toggle');
            const menu = dropdown?.querySelector('.pf-c-dropdown__menu');
            
            if (toggle && menu) {
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.hidden = !menu.hidden;
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
            const icon = row.querySelector('.listing-ct-toggle i');
            icon.className = 'fa fa-angle-down';

            const detailsRow = document.createElement('tr');
            detailsRow.className = 'pf-c-table__tr pool-details';
            detailsRow.innerHTML = `
                <td class="pf-c-table__td" colspan="11">
                    <div class="pf-c-tabs">
                        <ul class="pf-c-tabs__list">
                            <li class="pf-c-tabs__item pf-m-current">
                                <button class="pf-c-tabs__link" data-tab="filesystems">File Systems</button>
                            </li>
                            <li class="pf-c-tabs__item">
                                <button class="pf-c-tabs__link" data-tab="snapshots">Snapshots</button>
                            </li>
                            <li class="pf-c-tabs__item">
                                <button class="pf-c-tabs__link" data-tab="status">Status</button>
                            </li>
                        </ul>
                    </div>
                    <div class="tab-content">
                        <div class="tab-pane active" data-tab="filesystems">
                            <div class="spinner spinner-lg"></div>
                        </div>
                        <div class="tab-pane" data-tab="snapshots" style="display: none;">
                            <div class="spinner spinner-lg"></div>
                        </div>
                        <div class="tab-pane" data-tab="status" style="display: none;">
                            <div class="spinner spinner-lg"></div>
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
            const icon = row.querySelector('.listing-ct-toggle i');
            icon.className = 'fa fa-angle-right';
            const detailsRow = row.nextElementSibling;
            if (detailsRow && detailsRow.classList.contains('pool-details')) {
                detailsRow.remove();
            }
        }

        switchTab(detailsRow, tabName) {
            // Update tab buttons
            detailsRow.querySelectorAll('.pf-c-tabs__item').forEach(item => {
                item.classList.remove('pf-m-current');
            });
            detailsRow.querySelector(`[data-tab="${tabName}"]`).closest('.pf-c-tabs__item').classList.add('pf-m-current');

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
                <div class="pf-c-toolbar">
                    <div class="pf-c-toolbar__content">
                        <div class="pf-c-toolbar__content-section">
                            <button class="pf-c-button pf-m-primary" data-action="create-filesystem">
                                <i class="fa fa-plus" aria-hidden="true"></i> Create File System
                            </button>
                        </div>
                    </div>
                </div>
                <table class="pf-c-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Used</th>
                            <th>Available</th>
                            <th>Referenced</th>
                            <th>Mountpoint</th>
                            <th>Type</th>
                            <th>Encryption</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            filesystems.forEach(fs => {
                html += `
                    <tr>
                        <td>${Utils.escapeHtml(fs.name)}</td>
                        <td>${Utils.escapeHtml(fs.used)}</td>
                        <td>${Utils.escapeHtml(fs.avail)}</td>
                        <td>${Utils.escapeHtml(fs.refer)}</td>
                        <td>${Utils.escapeHtml(fs.mountpoint)}</td>
                        <td>${Utils.escapeHtml(fs.type)}</td>
                        <td>${fs.encryption !== 'off' ? '<span class="pf-c-label pf-m-blue"><i class="fa fa-lock"></i> Encrypted</span>' : '-'}</td>
                        <td>
                            <div class="pf-c-dropdown">
                                <button class="pf-c-dropdown__toggle pf-m-plain" type="button">
                                    <i class="fa fa-ellipsis-v"></i>
                                </button>
                                <ul class="pf-c-dropdown__menu" hidden>
                                    <li><button class="pf-c-dropdown__menu-item" data-action="snapshot">Create Snapshot</button></li>
                                    <li><button class="pf-c-dropdown__menu-item" data-action="clone">Clone</button></li>
                                    <li><button class="pf-c-dropdown__menu-item pf-m-danger" data-action="destroy">Destroy</button></li>
                                </ul>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += '</tbody></table>';
            container.innerHTML = html;

            // Add event listeners
            container.querySelector('[data-action="create-filesystem"]')?.addEventListener('click', () => {
                this.showCreateFileSystemModal(pool);
            });

            // Filesystem action dropdowns
            container.querySelectorAll('.pf-c-dropdown').forEach(dropdown => {
                const toggle = dropdown.querySelector('.pf-c-dropdown__toggle');
                const menu = dropdown.querySelector('.pf-c-dropdown__menu');
                
                if (toggle && menu) {
                    toggle.addEventListener('click', (e) => {
                        e.stopPropagation();
                        menu.hidden = !menu.hidden;
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
                <div class="pf-c-toolbar">
                    <div class="pf-c-toolbar__content">
                        <div class="pf-c-toolbar__content-section">
                            <button class="pf-c-button pf-m-primary" data-action="create-snapshot">
                                <i class="fa fa-plus" aria-hidden="true"></i> Create Snapshot
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
                <table class="pf-c-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Used</th>
                            <th>Referenced</th>
                            <th>Creation</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            snapshots.forEach(snap => {
                html += `
                    <tr>
                        <td>${Utils.escapeHtml(snap.name)}</td>
                        <td>${Utils.escapeHtml(snap.used)}</td>
                        <td>${Utils.escapeHtml(snap.refer)}</td>
                        <td>${Utils.escapeHtml(snap.creation)}</td>
                        <td>
                            <div class="pf-c-dropdown">
                                <button class="pf-c-dropdown__toggle pf-m-plain" type="button">
                                    <i class="fa fa-ellipsis-v"></i>
                                </button>
                                <ul class="pf-c-dropdown__menu" hidden>
                                    <li><button class="pf-c-dropdown__menu-item" data-action="clone">Clone</button></li>
                                    <li><button class="pf-c-dropdown__menu-item" data-action="rollback">Rollback</button></li>
                                    <li><button class="pf-c-dropdown__menu-item pf-m-danger" data-action="destroy">Destroy</button></li>
                                </ul>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += '</tbody></table>';
            container.innerHTML = html;

            // Add event listeners
            container.querySelector('[data-action="create-snapshot"]')?.addEventListener('click', () => {
                this.showCreateSnapshotModal(pool);
            });

            // Snapshot action dropdowns
            container.querySelectorAll('.pf-c-dropdown').forEach(dropdown => {
                const toggle = dropdown.querySelector('.pf-c-dropdown__toggle');
                const menu = dropdown.querySelector('.pf-c-dropdown__menu');
                
                if (toggle && menu) {
                    toggle.addEventListener('click', (e) => {
                        e.stopPropagation();
                        menu.hidden = !menu.hidden;
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
                        container.innerHTML = `<pre class="pf-c-code-block">${Utils.escapeHtml(output)}</pre>`;
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
                `<pre class="pf-c-code-block">Loading...</pre>`, 
                { footer: false });
            modal.show();

            const proc = cockpit.spawn(['zpool', 'status', pool.name]);
            let output = '';
            proc.stream((data) => output += data);
            proc.done(() => {
                modal.modal.querySelector('.pf-c-code-block').textContent = output;
            });
        }

        showCreatePoolModal() {
            const content = `
                <form id="create-pool-form">
                    <div class="pf-c-form-group">
                        <label class="pf-c-form__label" for="pool-name">
                            <span class="pf-c-form__label-text">Pool Name</span>
                        </label>
                        <input class="pf-c-form-control" type="text" id="pool-name" name="name" required>
                    </div>
                    <div class="pf-c-form-group">
                        <label class="pf-c-form__label" for="pool-devices">
                            <span class="pf-c-form__label-text">Devices</span>
                        </label>
                        <textarea class="pf-c-form-control" id="pool-devices" name="devices" 
                                  placeholder="/dev/sdb /dev/sdc" required></textarea>
                        <div class="pf-c-form__helper-text">Space-separated list of devices</div>
                    </div>
                    <div class="pf-c-form-group">
                        <label class="pf-c-form__label">
                            <input type="checkbox" id="pool-raidz" name="raidz"> Use RAID-Z
                        </label>
                    </div>
                </form>
            `;

            const modal = new Modal('Create Storage Pool', content, {
                onConfirm: () => {
                    const form = document.getElementById('create-pool-form');
                    const formData = new FormData(form);
                    const name = formData.get('name');
                    const devices = formData.get('devices').split(/\s+/).filter(d => d);
                    const raidz = formData.get('raidz');

                    if (!name || devices.length === 0) {
                        Utils.showNotification('warning', 'Validation Error', 'Please fill in all required fields');
                        return false;
                    }

                    this.createPool(name, devices, raidz);
                    return true;
                }
            });
            modal.show();
        }

        async createPool(name, devices, raidz) {
            try {
                const args = ['zpool', 'create'];
                if (raidz) {
                    args.push('-o', 'raidz');
                }
                args.push(name, ...devices);

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
                    <div class="pf-c-form-group">
                        <label class="pf-c-form__label" for="import-pool-name">
                            <span class="pf-c-form__label-text">Pool Name (optional)</span>
                        </label>
                        <input class="pf-c-form-control" type="text" id="import-pool-name" name="name">
                        <div class="pf-c-form__helper-text">Leave empty to import all available pools</div>
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
                    <div class="pf-c-form-group">
                        <label class="pf-c-form__label" for="fs-name">
                            <span class="pf-c-form__label-text">File System Name</span>
                        </label>
                        <input class="pf-c-form-control" type="text" id="fs-name" name="name" 
                               placeholder="${pool.name}/" required>
                    </div>
                    <div class="pf-c-form-group">
                        <label class="pf-c-form__label">
                            <input type="checkbox" id="fs-encrypted" name="encrypted"> Encrypted
                        </label>
                    </div>
                    <div class="pf-c-form-group" id="fs-passphrase-group" style="display: none;">
                        <label class="pf-c-form__label" for="fs-passphrase">
                            <span class="pf-c-form__label-text">Passphrase</span>
                        </label>
                        <input class="pf-c-form-control" type="password" id="fs-passphrase" name="passphrase">
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
                    <div class="pf-c-form-group">
                        <label class="pf-c-form__label" for="unlock-pool">
                            <span class="pf-c-form__label-text">Pool Name</span>
                        </label>
                        <select class="pf-c-form-control" id="unlock-pool" name="pool" required>
                            <option value="">Select a pool...</option>
                            ${this.pools.map(p => `<option value="${Utils.escapeHtml(p.name)}">${Utils.escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="pf-c-form-group">
                        <label class="pf-c-form__label" for="unlock-passphrase">
                            <span class="pf-c-form__label-text">Passphrase</span>
                        </label>
                        <input class="pf-c-form-control" type="password" id="unlock-passphrase" name="passphrase" required>
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
                <div class="pf-c-alert pf-m-info">
                    <div class="pf-c-alert__icon">
                        <i class="fa fa-info-circle" aria-hidden="true"></i>
                    </div>
                    <h4 class="pf-c-alert__title">Configuration</h4>
                    <div class="pf-c-alert__description">
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
                    <div class="pf-c-form-group">
                        <label class="pf-c-form__label" for="snapshot-name">
                            <span class="pf-c-form__label-text">Snapshot Name</span>
                        </label>
                        <input class="pf-c-form-control" type="text" id="snapshot-name" name="name" 
                               placeholder="${filesystem || pool.name}@snapshot-name" required>
                        <div class="pf-c-form__helper-text">Format: filesystem@snapshot-name</div>
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
                    <div class="pf-c-form-group">
                        <label class="pf-c-form__label" for="clone-name">
                            <span class="pf-c-form__label-text">Clone Name</span>
                        </label>
                        <input class="pf-c-form-control" type="text" id="clone-name" name="name" required>
                        <div class="pf-c-form__helper-text">Name for the cloned file system</div>
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
                    <div class="pf-c-form-group">
                        <label class="pf-c-form__label" for="clone-snapshot-name">
                            <span class="pf-c-form__label-text">Clone Name</span>
                        </label>
                        <input class="pf-c-form-control" type="text" id="clone-snapshot-name" name="name" required>
                        <div class="pf-c-form__helper-text">Name for the cloned file system from snapshot</div>
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
