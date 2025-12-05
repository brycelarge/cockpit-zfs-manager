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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState({});
    const [sanoidSnapshots, setSanoidSnapshots] = useState([]);
    const [isConfigured, setIsConfigured] = useState(false);

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
                    <p style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}>
                        Use the <strong>Configure Sanoid</strong> button on the main Storage Pools page to edit the configuration.
                    </p>
                </Alert>
            )}

            {isConfigured && (
                <Alert variant="success" title={`Pool "${pool.name}" is configured`} style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>This pool is configured in Sanoid. Automatic snapshots should be created according to your schedule.</p>
                </Alert>
            )}

            {sanoidSnapshots.length > 0 ? (
                <Alert variant="info" title={`${sanoidSnapshots.length} sanoid-managed snapshots found`} style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>Sanoid has created {sanoidSnapshots.length} automatic snapshots for this pool.</p>
                </Alert>
            ) : (
                <Alert variant="info" title="No sanoid snapshots found" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>No snapshots created by Sanoid were found for this pool.</p>
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

