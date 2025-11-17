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
    const [error, setError] = useState({});
    const [sanoidSnapshots, setSanoidSnapshots] = useState([]);

    useEffect(() => {
        checkSanoid();
    }, [pool.name]);

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
            <Alert variant="info" title="Sanoid is not installed">
                <p>Sanoid is a tool for automatic ZFS snapshot management.</p>
                <p>To install sanoid:</p>
                <ul>
                    <li><strong>Debian/Ubuntu:</strong> <code>sudo apt install sanoid</code></li>
                    <li><strong>Fedora/RHEL:</strong> <code>sudo dnf install sanoid</code></li>
                    <li><strong>FreeBSD:</strong> <code>sudo pkg install py38-sanoid</code></li>
                </ul>
                <p>After installation, create a configuration file at <code>/etc/sanoid/sanoid.conf</code></p>
            </Alert>
        );
    }

    if (!configPath) {
        return (
            <Alert variant="warning" title="Sanoid configuration not found">
                <p>Sanoid is installed but no configuration file was found.</p>
                <p>Create a configuration file at <code>/etc/sanoid/sanoid.conf</code></p>
                <p>Example configuration:</p>
                <pre style={{
                    background: 'var(--pf-t--global--background--color--200)',
                    padding: 'var(--pf-t--global--spacer--md)',
                    borderRadius: 'var(--pf-t--global--border--radius--small)',
                    overflow: 'auto'
                }}>
{`[${pool.name}]
use_template = production
recursive = yes

[template_production]
hourly = 24
daily = 7
monthly = 3
autosnap = yes
autoprune = yes`}
                </pre>
            </Alert>
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
                            fontSize: 'var(--pf-t--global--font--size--sm)'
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

