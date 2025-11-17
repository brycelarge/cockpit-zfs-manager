const cockpit = window.cockpit;

export class SanoidApi {
    static async isInstalled() {
        return new Promise((resolve) => {
            // Try running sanoid --version directly - this is the most reliable way to check
            // If sanoid is installed, this will succeed (exit code 0 or null/undefined)
            // If not installed, it will fail with a clear error
            const proc = cockpit.spawn(['sanoid', '--version'], { err: 'message' });
            let output = '';
            
            proc.stream((data) => {
                output += data;
            });
            
            proc.done((exitCode) => {
                // Exit code 0 means found and working
                // null/undefined/empty exit code means process completed (treat as found if we got output)
                // If we got output, sanoid is installed and working
                resolve(exitCode === 0 || ((exitCode == null || exitCode === '' || exitCode === undefined) && output.trim().length > 0));
            });
            proc.fail(() => {
                resolve(false);
            });
        });
    }

    static async detectPackageManager() {
        const checkCommand = (cmd) => {
            return new Promise((resolve) => {
                const proc = cockpit.spawn(['which', cmd]);
                proc.done((exitCode) => {
                    // Exit code 0 means found, null/undefined means process completed (treat as found)
                    resolve(exitCode === 0 || exitCode == null || exitCode === undefined);
                });
                proc.fail(() => resolve(false));
            });
        };

        // Check in order of preference
        if (await checkCommand('apt')) {
            return 'apt';
        }
        if (await checkCommand('dnf')) {
            return 'dnf';
        }
        if (await checkCommand('pkg')) {
            return 'pkg';
        }
        return null;
    }

    static async installSanoid() {
        return new Promise(async (resolve, reject) => {
            const pkgManager = await this.detectPackageManager();
            
            if (!pkgManager) {
                reject(new Error('No supported package manager found (apt, dnf, or pkg)'));
                return;
            }

            let installCmd;
            let packageName;
            
            if (pkgManager === 'apt') {
                installCmd = ['apt', 'install', '-y', 'sanoid'];
                packageName = 'sanoid';
            } else if (pkgManager === 'dnf') {
                installCmd = ['dnf', 'install', '-y', 'sanoid'];
                packageName = 'sanoid';
            } else if (pkgManager === 'pkg') {
                installCmd = ['pkg', 'install', '-y', 'py38-sanoid'];
                packageName = 'py38-sanoid';
            }

            const proc = cockpit.spawn(installCmd, {
                err: 'message',
                superuser: 'require'
            });
            
            let output = '';
            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve({ success: true, output });
                } else {
                    reject(new Error(`Installation failed: ${output || `exit code ${exitCode}`}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async createInitialConfig(poolName, configPath = '/etc/sanoid/sanoid.conf') {
        const defaultConfig = `[${poolName}]
use_template = production
recursive = yes

[template_production]
hourly = 24
daily = 7
monthly = 3
yearly = 1
autosnap = yes
autoprune = yes
`;

        return new Promise(async (resolve, reject) => {
            // Create directory if it doesn't exist
            const dirPath = configPath.substring(0, configPath.lastIndexOf('/'));
            const mkdirProc = cockpit.spawn(['mkdir', '-p', dirPath], {
                err: 'message',
                superuser: 'require'
            });

            mkdirProc.done(async (exitCode) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode !== 0 && exitCode != null && exitCode !== '' && exitCode !== undefined) {
                    reject(new Error(`Failed to create directory ${dirPath}: exit code ${exitCode}`));
                    return;
                }

                // Write config file
                try {
                    await this.writeConfig(configPath, defaultConfig);
                    resolve({ success: true, configPath });
                } catch (error) {
                    reject(error);
                }
            });

            mkdirProc.fail((error) => {
                reject(error);
            });
        });
    }

    static async getConfigPath() {
        // Common sanoid config paths
        const paths = [
            '/etc/sanoid/sanoid.conf',
            '/usr/local/etc/sanoid/sanoid.conf',
            '/etc/sanoid.conf'
        ];

        for (const path of paths) {
            const proc = cockpit.spawn(['test', '-f', path]);
            const exists = await new Promise((resolve) => {
                proc.done((exitCode) => resolve(exitCode === 0));
                proc.fail(() => resolve(false));
            });
            if (exists) {
                return path;
            }
        }
        return null;
    }

    static async readConfig(configPath) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['cat', configPath]);
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve(output);
                } else {
                    reject(new Error(`Failed to read config: exit code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async writeConfig(configPath, content) {
        return new Promise((resolve, reject) => {
            // Write to temp file first, then move
            const tempPath = `${configPath}.tmp`;
            // Use Python to write the file properly (handles multiline and special chars)
            const pythonCmd = `import sys; f=open('${tempPath}', 'w'); f.write(sys.stdin.read()); f.close()`;
            const proc = cockpit.spawn(['python3', '-c', pythonCmd], {
                err: 'message'
            });

            proc.input(content);

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    // Move temp file to final location
                    const moveProc = cockpit.spawn(['mv', tempPath, configPath]);
                    moveProc.done((moveExitCode) => {
                        if (moveExitCode === 0) {
                            resolve();
                        } else {
                            reject(new Error(`Failed to move config file: exit code ${moveExitCode}`));
                        }
                    });
                    moveProc.fail((error) => {
                        reject(error);
                    });
                } else {
                    reject(new Error(`Failed to write config: exit code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async getStatus() {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['sanoid', '--version'], { err: 'message' });
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve({ version: output.trim(), installed: true });
                } else {
                    resolve({ installed: false });
                }
            });

            proc.fail(() => {
                resolve({ installed: false });
            });
        });
    }

    static async testConfig(configPath) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['sanoid', '--config', configPath, '--dry-run'], { err: 'message' });
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve({ valid: true, output });
                } else {
                    resolve({ valid: false, output });
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async getSnapshotsForDataset(datasetName) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zfs', 'list', '-H', '-o', 'name', '-t', 'snapshot', '-r', datasetName]);
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    const snapshots = output.trim().split('\n').filter(s => s.trim());
                    // Filter for sanoid-created snapshots (they typically have autosnap_ prefix)
                    const sanoidSnapshots = snapshots.filter(s => s.includes('autosnap_'));
                    resolve(sanoidSnapshots);
                } else {
                    resolve([]);
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static parseConfig(configText) {
        const lines = configText.split('\n');
        const sections = [];
        let currentSection = null;
        let currentTemplate = null;

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip comments and empty lines
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            // Section header: [dataset] or [template_name]
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                const name = trimmed.slice(1, -1);
                if (name.startsWith('template_')) {
                    currentTemplate = {
                        name: name.replace('template_', ''),
                        type: 'template',
                        options: {}
                    };
                    sections.push(currentTemplate);
                    currentSection = null;
                } else {
                    currentSection = {
                        dataset: name,
                        type: 'dataset',
                        options: {}
                    };
                    sections.push(currentSection);
                    currentTemplate = null;
                }
                continue;
            }

            // Parse key = value
            const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
            if (match) {
                const [, key, value] = match;
                const target = currentSection || currentTemplate;
                if (target) {
                    // Parse boolean values
                    if (value === 'yes' || value === 'true') {
                        target.options[key] = true;
                    } else if (value === 'no' || value === 'false') {
                        target.options[key] = false;
                    } else if (!isNaN(value)) {
                        target.options[key] = parseInt(value, 10);
                    } else {
                        target.options[key] = value;
                    }
                }
            }
        }

        return sections;
    }

    static formatConfig(sections) {
        let output = '';
        
        for (const section of sections) {
            if (section.type === 'template') {
                output += `[template_${section.name}]\n`;
            } else {
                output += `[${section.dataset}]\n`;
            }

            for (const [key, value] of Object.entries(section.options)) {
                if (typeof value === 'boolean') {
                    output += `${key} = ${value ? 'yes' : 'no'}\n`;
                } else {
                    output += `${key} = ${value}\n`;
                }
            }
            output += '\n';
        }

        return output;
    }
}

