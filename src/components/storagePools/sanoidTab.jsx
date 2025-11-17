import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";
import { TextArea } from "@patternfly/react-core/dist/esm/components/TextArea";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { SanoidApi } from '../../zfsApi/sanoid.js';

function SanoidTab({ pool }) {
    const [installed, setInstalled] = useState(null);
    const [configPath, setConfigPath] = useState(null);
    const [configContent, setConfigContent] = useState('');
    const [originalConfig, setOriginalConfig] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [packageManager, setPackageManager] = useState(null);
    const [error, setError] = useState({});
    const [sanoidSnapshots, setSanoidSnapshots] = useState([]);

    useEffect(() => {
        checkSanoid();
    }, [pool.name]);

    useEffect(() => {
        detectPackageManager();
    }, []);

    const detectPackageManager = async () => {
        try {
            const pm = await SanoidApi.detectPackageManager();
            setPackageManager(pm);
        } catch (exc) {
            console.error('Failed to detect package manager:', exc);
        }
    };

    const checkSanoid = async () => {
        setLoading(true);
        try {
            const isInstalled = await SanoidApi.isInstalled();
            setInstalled(isInstalled);

            if (isInstalled) {
                const path = await SanoidApi.getConfigPath();
                setConfigPath(path);
                
                if (path) {
                    const content = await SanoidApi.readConfig(path);
                    setConfigContent(content);
                    setOriginalConfig(content);
                }

                // Get sanoid snapshots for this pool
                const snaps = await SanoidApi.getSnapshotsForDataset(pool.name);
                setSanoidSnapshots(snaps);
            }
        } catch (exc) {
            setError({
                dialogError: 'Failed to check sanoid status',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async () => {
        setInstalling(true);
        setError({});
        
        try {
            // Install sanoid
            await SanoidApi.installSanoid();
            
            // Create initial config
            const configPath = '/etc/sanoid/sanoid.conf';
            await SanoidApi.createInitialConfig(pool.name, configPath);
            
            // Refresh status
            await checkSanoid();
        } catch (exc) {
            setError({
                dialogError: 'Failed to install sanoid',
                dialogErrorDetail: exc.message || String(exc)
            });
            setInstalling(false);
        }
    };

    const handleCreateConfig = async () => {
        setSaving(true);
        setError({});
        
        try {
            const configPath = '/etc/sanoid/sanoid.conf';
            await SanoidApi.createInitialConfig(pool.name, configPath);
            await checkSanoid();
        } catch (exc) {
            setError({
                dialogError: 'Failed to create configuration',
                dialogErrorDetail: exc.message || String(exc)
            });
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!configPath) {
            setError({
                dialogError: 'No configuration file found',
                dialogErrorDetail: 'Please install sanoid and create a configuration file at /etc/sanoid/sanoid.conf'
            });
            return;
        }

        setSaving(true);
        setError({});

        try {
            // Test config first
            const testResult = await SanoidApi.testConfig(configPath);
            if (!testResult.valid && testResult.output) {
                setError({
                    dialogError: 'Configuration validation failed',
                    dialogErrorDetail: testResult.output
                });
                setSaving(false);
                return;
            }

            // Write config
            await SanoidApi.writeConfig(configPath, configContent);
            setOriginalConfig(configContent);
            setError({});
        } catch (exc) {
            setError({
                dialogError: 'Failed to save configuration',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setConfigContent(originalConfig);
        setError({});
    };

    const hasChanges = configContent !== originalConfig;

    if (loading) {
        return <Spinner size="lg" aria-label="Loading sanoid status" />;
    }

    if (!installed) {
        return (
            <div>
                <Alert variant="info" title="Sanoid is not installed" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>Sanoid is a tool for automatic ZFS snapshot management.</p>
                    {packageManager ? (
                        <p>Detected package manager: <strong>{packageManager}</strong></p>
                    ) : (
                        <p>No supported package manager detected. Manual installation required.</p>
                    )}
                </Alert>

                {error.dialogError && (
                    <ModalError
                        dialogError={error.dialogError}
                        {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                    />
                )}

                {packageManager && (
                    <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
                        <Button
                            variant="primary"
                            onClick={handleInstall}
                            isDisabled={installing}
                            isLoading={installing}
                        >
                            Install Sanoid and Create Configuration
                        </Button>
                        <p style={{ marginTop: 'var(--pf-t--global--spacer--sm)', color: 'var(--pf-t--global--text--color--muted)' }}>
                            This will install sanoid using {packageManager} and create an initial configuration file for pool "{pool.name}".
                        </p>
                    </div>
                )}

                {!packageManager && (
                    <Alert variant="warning" title="Manual installation required" style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
                        <p>Please install sanoid manually:</p>
                        <ul>
                            <li><strong>Debian/Ubuntu:</strong> <code>sudo apt install sanoid</code></li>
                            <li><strong>Fedora/RHEL:</strong> <code>sudo dnf install sanoid</code></li>
                            <li><strong>FreeBSD:</strong> <code>sudo pkg install py38-sanoid</code></li>
                        </ul>
                        <p>After installation, refresh this page to configure sanoid.</p>
                    </Alert>
                )}
            </div>
        );
    }

    if (!configPath) {
        return (
            <div>
                <Alert variant="warning" title="Sanoid configuration not found" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>Sanoid is installed but no configuration file was found in the standard locations.</p>
                    {sanoidSnapshots.length > 0 && (
                        <p style={{ marginTop: 'var(--pf-t--global--spacer--sm)', fontWeight: 'bold' }}>
                            Note: Sanoid has created {sanoidSnapshots.length} snapshot(s) for this pool, so a configuration file exists somewhere.
                            It may be in a non-standard location or sanoid may be using default settings.
                        </p>
                    )}
                    <p>Create a configuration file at <code>/etc/sanoid/sanoid.conf</code> to manage it from this interface.</p>
                </Alert>

                {error.dialogError && (
                    <ModalError
                        dialogError={error.dialogError}
                        {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                    />
                )}

                <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
                    <Button
                        variant="primary"
                        onClick={handleCreateConfig}
                        isDisabled={saving}
                        isLoading={saving}
                    >
                        Create Initial Configuration
                    </Button>
                    <p style={{ marginTop: 'var(--pf-t--global--spacer--sm)', color: 'var(--pf-t--global--text--color--muted)' }}>
                        This will create a default configuration file for pool "{pool.name}".
                    </p>
                </div>

                <Alert variant="info" title="Example configuration" style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
                    <pre style={{
                        background: 'var(--pf-t--global--background--color--200)',
                        color: 'var(--pf-t--global--text--color--100)',
                        padding: 'var(--pf-t--global--spacer--md)',
                        borderRadius: 'var(--pf-t--global--border--radius--small)',
                        overflow: 'auto',
                        marginTop: 'var(--pf-t--global--spacer--sm)'
                    }}>
{`[${pool.name}]
use_template = production
recursive = yes

[template_production]
hourly = 6
daily = 3
monthly = 1
yearly = 1
autosnap = yes
autoprune = yes`}
                    </pre>
                </Alert>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                <div>
                    <strong>Configuration:</strong> {configPath}
                </div>
                <div>
                    <Button variant="secondary" onClick={checkSanoid} isDisabled={loading || saving}>
                        Refresh
                    </Button>
                </div>
            </div>

            {sanoidSnapshots.length > 0 && (
                <Alert variant="info" title={`${sanoidSnapshots.length} sanoid-managed snapshots found`} style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>Sanoid has created {sanoidSnapshots.length} automatic snapshots for this pool.</p>
                </Alert>
            )}

            {error.dialogError && (
                <ModalError
                    dialogError={error.dialogError}
                    {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                />
            )}

            <Form>
                <FormGroup
                    label="Sanoid Configuration"
                    fieldId="sanoid-config"
                    helperText="Edit the sanoid configuration for this pool. Changes are saved immediately."
                >
                    <TextArea
                        id="sanoid-config"
                        value={configContent}
                        onChange={(_, value) => {
                            setConfigContent(value);
                            if (error.dialogError) {
                                setError({});
                            }
                        }}
                        rows={20}
                        style={{
                            fontFamily: 'var(--pf-t--global--font--family--mono)',
                            fontSize: 'var(--pf-t--global--font--size--sm)',
                            backgroundColor: 'var(--pf-t--global--background--color--100)',
                            color: 'var(--pf-t--global--text--color--100)'
                        }}
                    />
                </FormGroup>
            </Form>

            <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', marginTop: 'var(--pf-t--global--spacer--md)' }}>
                <Button
                    variant="primary"
                    onClick={handleSave}
                    isDisabled={!hasChanges || saving}
                    isLoading={saving}
                >
                    Save Configuration
                </Button>
                <Button
                    variant="secondary"
                    onClick={handleReset}
                    isDisabled={!hasChanges || saving}
                >
                    Reset
                </Button>
            </div>

            {hasChanges && (
                <Alert variant="warning" title="Unsaved changes" style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
                    You have unsaved changes. Click "Save Configuration" to apply them.
                </Alert>
            )}
        </div>
    );
}

export default SanoidTab;

