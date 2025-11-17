const cockpit = window.cockpit;

export class SanoidApi {
    static async isInstalled() {
        return new Promise((resolve) => {
            const proc = cockpit.spawn(['which', 'sanoid']);
            proc.done((exitCode) => {
                resolve(exitCode === 0);
            });
            proc.fail(() => {
                resolve(false);
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

