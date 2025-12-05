import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { SanoidApi } from '../../zfsApi/sanoid.js';

function SanoidTab({ pool, onConfigureSanoid }) {
    const [installed, setInstalled] = useState(null);
    const [configPath, setConfigPath] = useState(null);
    const [configContent, setConfigContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState({});
    const [isConfigured, setIsConfigured] = useState(false);
    const [enabling, setEnabling] = useState(false);

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

                    // Check if this pool is configured in the file
                    // Simple check for [poolname] section
                    const regex = new RegExp(`^\\[${pool.name}\\]`, 'm');
                    setIsConfigured(regex.test(content));
                }
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
        // Removed
    };

    const handleCreateConfig = async () => {
        // Removed
    };

    const handleSave = async () => {
        // Removed
    };

    const handleReset = () => {
        setConfigContent('');
        setError({});
    };

    const handleEnablePool = async () => {
        setEnabling(true);
        setError({});
        try {
            const content = await SanoidApi.readConfig(configPath);

            const poolConfig = `
# Automatically enabled for pool ${pool.name}
[${pool.name}]
use_template = production
recursive = yes
`;
            const newContent = content + poolConfig;

            await SanoidApi.writeConfig(configPath, newContent);

            // Re-check
            await checkSanoid();
        } catch (exc) {
            setError({
                dialogError: 'Failed to enable pool',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setEnabling(false);
        }
    };

    if (loading) {
        return <Spinner size="lg" aria-label="Loading sanoid status" />;
    }

    if (!installed) {
        return (
            <div>
                <Alert variant="info" title="Sanoid is not installed" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>Sanoid is a tool for automatic ZFS snapshot management.</p>
                    <p>Please use the "Configure Sanoid" button on the main Storage Pools page to install Sanoid.</p>
                </Alert>

                {error.dialogError && (
                    <ModalError
                        dialogError={error.dialogError}
                        {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                    />
                )}
            </div>
        );
    }

    if (!configPath) {
        return (
            <div>
                <Alert variant="warning" title="Sanoid configuration not found" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>Sanoid is installed but no configuration file was found.</p>
                    <p>Please use the "Configure Sanoid" button on the Storage Pools page to set up Sanoid.</p>
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
                    <Button variant="secondary" onClick={checkSanoid} isDisabled={loading}>
                        Refresh
                    </Button>
                </div>
            </div>

            {!isConfigured && (
                <Alert variant="warning" title={`Pool "${pool.name}" is not configured in Sanoid`} style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>This pool does not appear to have a configuration section in <code>{configPath}</code>.</p>
                    <p>Automatic snapshots will not be created until you add a section for this pool.</p>
                    <div style={{ marginTop: 'var(--pf-t--global--spacer--md)', display: 'flex', gap: '1rem' }}>
                        <Button variant="primary" onClick={handleEnablePool} isLoading={enabling} isDisabled={enabling || loading}>
                            Enable Automation
                        </Button>
                        {onConfigureSanoid && (
                            <Button variant="secondary" onClick={onConfigureSanoid} isDisabled={enabling || loading}>
                                Edit Configuration Manually
                            </Button>
                        )}
                    </div>
                </Alert>
            )}

            {isConfigured && (
                <Alert variant="success" title={`Pool "${pool.name}" is configured`} style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>This pool is configured in Sanoid. Automatic snapshots should be created according to your schedule.</p>
                </Alert>
            )}

            {error.dialogError && (
                <ModalError
                    dialogError={error.dialogError}
                    {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                />
            )}
        </div>
    );
}

export default SanoidTab;

